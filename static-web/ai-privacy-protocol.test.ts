import { describe, expect, it } from 'vitest';
import {
  AI_SUPPORTED_TOOLS,
  buildAiSendPreview,
  buildScopedSummary,
  confirmByokHost,
  consumeCallBudget,
  createCallBudget,
  dialogShouldDismiss,
  inboxItemFromAiTool,
  inboxConfirmBlockReason,
  migratePrivacySettings,
  normalizeMemory,
  parseAiProviderResponse,
  prepareOutboundAiPayload,
  redactSensitiveText,
  sanitizeModelBoundFields,
  TOAST_ARIA_LIVE,
  validateByokTarget,
  classifyAiProviderError,
} from '../app/product-logic';

describe('independent memory-data permission', () => {
  it('migrates missing memory permission to off without deleting local memories', () => {
    const memories = [
      { id: 'm1', kind: '目标', title: '每月还债', note: '优先完成', active: true },
    ].map((item) => normalizeMemory(item));
    expect(memories[0]).toMatchObject({
      id: 'm1',
      title: '每月还债',
      note: '优先完成',
      active: true,
      sendAllowed: false,
    });
    expect(migratePrivacySettings({ schedule: true, finance: true, health: false })).toEqual({
      schedule: true,
      finance: true,
      health: false,
      memory: false,
    });
  });

  it('keeps local memories when memory permission is off and omits them from model context', () => {
    const summary = buildScopedSummary({
      today: '2026-08-29',
      month: '2026-08',
      privacy: { schedule: false, finance: false, health: false, memory: false },
      schedules: [{ date: '2026-08-29', done: false, title: '秘密日程' }],
      transactions: [{ createdAt: '2026-08-29' }],
      healthRecords: [],
      memories: [normalizeMemory({ id: 'm1', title: '每月还债', note: '优先完成', active: true, sendAllowed: true })],
    });
    expect(summary).toContain('记忆权限关闭');
    expect(summary).not.toContain('每月还债');
  });

  it('sends only memories that are both permitted and sendAllowed', () => {
    const summary = buildScopedSummary({
      today: '2026-08-29',
      month: '2026-08',
      privacy: { schedule: true, finance: true, health: true, memory: true },
      schedules: [],
      transactions: [],
      healthRecords: [],
      memories: [
        normalizeMemory({ id: 'a', title: '可发送', note: 'ok', active: true, sendAllowed: true }),
        normalizeMemory({ id: 'b', title: '仅本机', note: 'keep', active: true, sendAllowed: false }),
        normalizeMemory({ id: 'c', title: '已暂停', note: 'pause', active: false, sendAllowed: true }),
      ],
    });
    expect(summary).toContain('可发送');
    expect(summary).not.toContain('仅本机');
    expect(summary).not.toContain('已暂停');
  });
});

describe('deterministic sensitive-data redaction', () => {
  it('blocks Chinese and English secrets in user messages and never returns them', () => {
    const samples = [
      '密码是 hunter2',
      'password: hunter2',
      'API key sk-live-abc1234567890',
      'token=ghp_abcdefghijklmnopqrstuvwx',
      '验证码 483921',
      'OTP 483921',
      '私钥 BEGIN PRIVATE KEY',
      '助记词 apple banana cherry date elder fig grape',
      '卡号 4111111111111111',
      '账号 6222021234567890123',
    ];
    for (const sample of samples) {
      const result = redactSensitiveText(sample);
      expect(result.blocked, sample).toBe(true);
      expect(result.text, sample).not.toMatch(/hunter2|sk-live|ghp_|483921|PRIVATE KEY|apple banana|4111111111111111|6222021234567890123/i);
    }
  });

  it('redacts every model-bound field and refuses outbound send when secrets remain', () => {
    const outbound = prepareOutboundAiPayload({
      userMessage: '帮我记一笔，密码是 secret123',
      fields: {
        system: '用户允许的记忆=邮箱密码 secret123',
        title: 'token abcdefghijklmnop',
      },
    });
    expect(outbound.ok).toBe(false);
    expect(JSON.stringify(outbound)).not.toMatch(/secret123|abcdefghijklmnop/i);
    const clean = prepareOutboundAiPayload({
      userMessage: '明天 9 点提醒我吃药',
      fields: { system: '日程未完成=吃药' },
    });
    expect(clean.ok).toBe(true);
    expect(clean.messages?.[1]?.content).toBe('明天 9 点提醒我吃药');
  });

  it('walks nested model-bound objects without leaking secrets', () => {
    const sanitized = sanitizeModelBoundFields({
      nested: { apiKey: 'sk-secret', note: '验证码 112233' },
      list: ['ok', 'password=hunter2'],
    });
    expect(JSON.stringify(sanitized)).not.toMatch(/sk-secret|112233|hunter2/i);
  });
});

describe('visible send preview and host confirmation', () => {
  it('lists current data-scope fields without values and requires exact host confirmation', () => {
    const preview = buildAiSendPreview({
      privacy: { schedule: true, finance: false, health: true, memory: true },
      memories: [
        normalizeMemory({ id: 'm1', title: '可发送', note: '秘密备注', active: true, sendAllowed: true }),
      ],
      baseUrl: 'https://api.openai.com/v1',
    });
    expect(preview.domain).toBe('api.openai.com');
    expect(preview.fields.map((item) => item.key)).toEqual(expect.arrayContaining(['schedule', 'finance', 'health', 'memory', 'vault']));
    expect(preview.fields.find((item) => item.key === 'schedule')).toMatchObject({ included: true, valueShown: false });
    expect(preview.fields.find((item) => item.key === 'finance')).toMatchObject({ included: false, valueShown: false });
    expect(preview.fields.find((item) => item.key === 'vault')).toMatchObject({ included: false });
    expect(JSON.stringify(preview)).not.toContain('秘密备注');
    expect(confirmByokHost('https://api.openai.com/v1', 'api.openai.com')).toBe(true);
    expect(confirmByokHost('https://api.openai.com/v1', 'evil.example')).toBe(false);
  });
});

describe('provider-neutral AI tools', () => {
  it('advertises only the supported tools', () => {
    expect(AI_SUPPORTED_TOOLS).toEqual([
      'read_finance_summary',
      'draft_expense',
      'draft_schedule',
      'draft_memory_change',
    ]);
  });

  it('accepts JSON-schema / function-like tool calls and keeps mutations as inbox drafts', () => {
    const parsed = parseAiProviderResponse(JSON.stringify({
      reply: '建议记一笔，确认后才会保存。',
      tool_calls: [
        { name: 'read_finance_summary', arguments: {} },
        {
          name: 'draft_expense',
          arguments: {
            amount: 36,
            merchant: '午饭',
            accountId: '',
            currency: '',
            date: '',
            reimbursable: null,
          },
        },
        { name: 'draft_schedule', arguments: { title: '吃药', date: '2026-08-30', time: '09:00' } },
        { name: 'draft_memory_change', arguments: { op: 'add', title: '早睡' } },
        { name: 'wipe_vault', arguments: { id: 'v1' } },
      ],
    }));
    expect(parsed.mutatesState).toBe(false);
    expect(parsed.tools.map((item) => item.name)).toEqual([
      'read_finance_summary',
      'draft_expense',
      'draft_schedule',
      'draft_memory_change',
    ]);
    const expense = inboxItemFromAiTool({
      id: 'ai-e1',
      createdAt: '2026-08-30T10:00:00',
      tool: parsed.tools[1],
    });
    expect(expense?.proposedAction).toBe('create_expense');
    expect(expense?.status).toBe('pending');
    expect(expense?.payload).toMatchObject({
      amount: 36,
      merchant: '午饭',
      accountId: '',
      currency: '',
      date: '',
    });
    expect(expense?.payload.reimbursable).toBeUndefined();
  });

  it('rejects expense drafts that omit unresolved account currency date or reimbursable', () => {
    const parsed = parseAiProviderResponse(JSON.stringify({
      reply: '草稿',
      tool_calls: [
        { name: 'draft_expense', arguments: { amount: 36, merchant: '午饭' } },
      ],
    }));
    expect(parsed.tools).toEqual([]);
  });

  it('blocks inbox confirm until expense account currency and reimbursable are explicit', () => {
    const draft = inboxItemFromAiTool({
      id: 'ai-e2',
      createdAt: '2026-08-30T10:00:00',
      tool: {
        name: 'draft_expense',
        arguments: { amount: 12, merchant: '咖啡', accountId: '', currency: '', date: '', reimbursable: null },
      },
    });
    expect(draft).toBeTruthy();
    expect(inboxConfirmBlockReason(draft!, [{ id: 'cash' }])).toMatchObject({ reason: 'missing_account', dataScope: 'finance' });
    const filled = inboxItemFromAiTool({
      id: 'ai-e3',
      createdAt: '2026-08-30T10:00:00',
      tool: {
        name: 'draft_expense',
        arguments: { amount: 12, merchant: '咖啡', accountId: 'cash', currency: 'CNY', date: '2026-08-30', reimbursable: false },
      },
    });
    expect(inboxConfirmBlockReason(filled!, [{ id: 'cash' }])).toBeNull();
  });

  it('never silently defaults expense account currency date or reimbursable', () => {
    const parsed = parseAiProviderResponse({
      reply: '草稿',
      function_call: {
        name: 'draft_expense',
        arguments: { amount: 12, merchant: '咖啡', accountId: '', currency: '', date: '', reimbursable: null },
      },
    });
    const tool = parsed.tools[0];
    expect(tool?.name).toBe('draft_expense');
    if (tool?.name !== 'draft_expense') throw new Error('expected draft_expense');
    expect(tool.arguments.accountId).toBe('');
    expect(tool.arguments.currency).toBe('');
    expect(tool.arguments.date).toBe('');
    expect(tool.arguments.reimbursable).toBeNull();
  });
});

describe('BYOK target policy', () => {
  it('allows only https public hosts and rejects localhost private and link-local targets', () => {
    expect(validateByokTarget('https://api.openai.com/v1').ok).toBe(true);
    expect(validateByokTarget('http://api.openai.com/v1').ok).toBe(false);
    expect(validateByokTarget('https://localhost/v1').ok).toBe(false);
    expect(validateByokTarget('https://127.0.0.1/v1').ok).toBe(false);
    expect(validateByokTarget('https://10.0.0.8/v1').ok).toBe(false);
    expect(validateByokTarget('https://192.168.1.8/v1').ok).toBe(false);
    expect(validateByokTarget('https://172.16.0.8/v1').ok).toBe(false);
    expect(validateByokTarget('https://169.254.1.1/v1').ok).toBe(false);
    expect(validateByokTarget('https://[::1]/v1').ok).toBe(false);
    expect(validateByokTarget('https://[fe80::1]/v1').ok).toBe(false);
  });

  it('enforces timeout abort max-token and call budget', () => {
    const budget = createCallBudget({ maxCalls: 2, maxTokens: 128, timeoutMs: 15_000 });
    expect(budget.timeoutMs).toBe(15_000);
    expect(consumeCallBudget(budget, 64).ok).toBe(true);
    expect(consumeCallBudget(budget, 64).ok).toBe(true);
    expect(consumeCallBudget(budget, 1).ok).toBe(false);
    expect(consumeCallBudget(createCallBudget({ maxCalls: 3, maxTokens: 10, timeoutMs: 1000 }), 11).ok).toBe(false);
  });
});

describe('accessibility helpers', () => {
  it('exposes a polite live toast and dismisses dialogs on Escape', () => {
    expect(TOAST_ARIA_LIVE).toBe('polite');
    expect(dialogShouldDismiss('Escape')).toBe(true);
    expect(dialogShouldDismiss('Enter')).toBe(false);
  });
});

describe('AI provider error classes', () => {
  it('maps auth, missing model, timeout, quota and offline to user actions without leaking secrets', () => {
    expect(classifyAiProviderError({ status: 401, message: 'token_expired' })).toEqual({ code: 'auth', action: '重新输入密钥' });
    expect(classifyAiProviderError({ status: 404, message: 'model_not_found' })).toEqual({ code: 'model', action: '选择已发现模型' });
    expect(classifyAiProviderError({ message: 'timeout' })).toEqual({ code: 'timeout', action: '继续使用本地规则' });
    expect(classifyAiProviderError({ status: 429 })).toEqual({ code: 'quota', action: '等待或调整限制' });
    expect(classifyAiProviderError({ message: 'offline' })).toEqual({ code: 'offline', action: '继续使用本地规则' });
    expect(JSON.stringify(classifyAiProviderError({ status: 401, message: 'sk-secret' }))).not.toContain('sk-secret');
  });
});
