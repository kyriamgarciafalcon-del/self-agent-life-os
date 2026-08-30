import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildHealthBriefing,
  buildButlerSystemPrompt,
  buildScopedSummary,
  cnyWealthTotal,
  detectLegacyDemoData,
  isBackupPayload,
  localDateKey,
  migrateLegacyReimbursementAccounts,
  normalizeMemory,
  parseButlerModelOutput,
  parseNaturalCapture,
  assetTotals,
  accountRole,
  planAccountSettlement,
  applyLedger,
  applyDailyFxRates,
  applyDailyPriceQuotes,
  AI_CONFIG_STORAGE_KEY,
  AI_EVENT_VERSION,
  loadBrowserAiConfig,
  migrateLegacyAiLocalStorage,
  persistBrowserAiConfig,
  publicAiConfig,
  versionedAiEvent,
  canApplyLedger,
  defaultCashId,
  reconcileRecurringConfirmations,
  releaseRecurringConfirmation,
  removeLedgerTransactionState,
  resolvePaymentAccountId,
  settleReimbursementState,
  upsertByExternalKey,
  wealthTotals,
  weekDates,
  summarizeHealth,
  healthRecordsFromSnapshots,
  canUndoInboxConfirm,
  confirmInboxItem,
  enqueueInboxItem,
  ignoreInboxItem,
  inboxItemFromButlerAction,
  inboxItemFromNaturalCapture,
  inboxItemFromPayment,
  inboxItemFromTravelNotice,
  inboxSourceLabel,
  inboxConfidenceLabel,
  migrateInboxStore,
  normalizeInboxItem,
  normalizeInboxItems,
  normalizePermissionOnboarding,
  permissionOnboardingCards,
  permissionOnboardingProgress,
  shouldShowPermissionOnboarding,
  pendingInboxCount,
  reopenInboxItem,
  sanitizeInboxPayload,
  updateInboxItemPayload,
  AUDIT_LOG_LIMIT,
  applyInboxLifecycle,
  auditOutcomeLabel,
  auditReasonLabel,
  appendAuditEntry,
  canUndoAuditEntry,
  filterAuditLog,
  inboxConfirmBlockReason,
  migrateAuditLog,
} from '../app/product-logic';

describe('local date logic', () => {
  it('derives today and a Monday-first week from the device-local date', () => {
    const saturday = new Date(2026, 7, 29, 6, 30, 0);

    expect(localDateKey(saturday)).toBe('2026-08-29');
    expect(localDateKey(addDays(saturday, 1))).toBe('2026-08-30');
    expect(weekDates('2026-08-29').map((item) => item.value)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });
});

describe('natural capture', () => {
  it('understands the displayed spaced Chinese time example relative to today', () => {
    expect(parseNaturalCapture('明天 9 点提醒我吃药', '2026-08-29')).toEqual({
      kind: 'schedule',
      title: '吃药',
      date: '2026-08-30',
      time: '09:00',
    });
  });

  it('cleans punctuation from the displayed expense example', () => {
    expect(parseNaturalCapture('午饭 36 元，微信支付', '2026-08-29')).toMatchObject({
      kind: 'expense',
      amount: 36,
      merchant: '午饭',
      category: '餐饮',
      source: '微信',
    });
  });

  it('parses a train trip with number, stations and time as travel', () => {
    expect(parseNaturalCapture('明天 G123 北京南到上海虹桥 09:00', '2026-08-29')).toMatchObject({
      kind: 'travel',
      travelKind: 'train',
      number: 'G123',
      from: '北京南',
      to: '上海虹桥',
      date: '2026-08-30',
      departTime: '09:00',
    });
  });

  it('parses a flight with number, airports and time as travel', () => {
    expect(parseNaturalCapture('航班 MU5101 明天上海虹桥到北京首都 08:20', '2026-08-29')).toMatchObject({
      kind: 'travel',
      travelKind: 'flight',
      number: 'MU5101',
      from: '上海虹桥',
      to: '北京首都',
      date: '2026-08-30',
      departTime: '08:20',
    });
  });

  it('parses health metrics for steps heart rate stress sleep PAI height and weight', () => {
    expect(parseNaturalCapture('今天走了8000步', '2026-08-29')).toEqual({ kind: 'health', metric: 'steps', value: 8000 });
    expect(parseNaturalCapture('心率 62', '2026-08-29')).toEqual({ kind: 'health', metric: 'heartRate', value: 62 });
    expect(parseNaturalCapture('压力41', '2026-08-29')).toEqual({ kind: 'health', metric: 'stress', value: 41 });
    expect(parseNaturalCapture('睡眠 6.5 小时', '2026-08-29')).toEqual({ kind: 'health', metric: 'sleep', value: 6.5 });
    expect(parseNaturalCapture('PAI 88', '2026-08-29')).toEqual({ kind: 'health', metric: 'pai', value: 88 });
    expect(parseNaturalCapture('身高 172', '2026-08-29')).toEqual({ kind: 'health', metric: 'height', value: 172 });
    expect(parseNaturalCapture('体重 68.5 公斤', '2026-08-29')).toEqual({ kind: 'health', metric: 'weight', value: 68.5 });
  });
});

describe('butler action protocol', () => {
  it('parses only allowed drafts and never treats the model output as a mutation', () => {
    const parsed = parseButlerModelOutput(JSON.stringify({
      reply: '建议记下这趟车，确认后才会保存。',
      actions: [
        { type: 'create_schedule', payload: { title: '吃药', date: '2026-08-30', time: '09:00' } },
        { type: 'create_expense', payload: { amount: 36, merchant: '午饭' } },
        { type: 'create_travel', payload: { travelKind: 'train', number: 'G123', from: '北京南', to: '上海虹桥', date: '2026-08-30', departTime: '09:00' } },
        { type: 'create_health', payload: { metric: 'steps', value: 8000 } },
        { type: 'add_memory', payload: { title: '早睡', note: '23:30 前准备' } },
        { type: 'update_memory', payload: { id: 'm1', title: '每月结余至少 2000 元' } },
        { type: 'pause_memory', payload: { id: 'm2' } },
        { type: 'delete_memory', payload: { id: 'm3' } },
        { type: 'wipe_vault', payload: { id: 'v1' } },
      ],
    }));
    expect(parsed.reply).toContain('确认后才会保存');
    expect(parsed.actions.map((item) => item.type)).toEqual([
      'create_schedule',
      'create_expense',
      'create_travel',
      'create_health',
      'add_memory',
      'update_memory',
      'pause_memory',
      'delete_memory',
    ]);
    expect(parsed.mutatesState).toBe(false);
  });

  it('rejects incomplete expense drafts and secret-bearing payloads', () => {
    const parsed = parseButlerModelOutput('```json\n{"reply":"草稿","actions":[{"type":"create_expense","payload":{"merchant":"午饭"}},{"type":"add_memory","payload":{"title":"邮箱","password":"secret123","note":"不要外传"}}]}\n```');
    expect(parsed.actions).toEqual([]);
  });

  it('treats plain assistant text as a reply with no actions', () => {
    expect(parseButlerModelOutput('今天先把午饭记上。')).toEqual({ reply: '今天先把午饭记上。', actions: [], mutatesState: false });
  });
});

describe('butler privacy and health briefing', () => {
  it('fills source purpose updatedAt and status for legacy memories', () => {
    expect(normalizeMemory({ id: 'm1', kind: '目标', title: '每月结余至少 2,000 元', note: '用于生成财务提醒，不自动修改账户。', active: true })).toMatchObject({
      id: 'm1',
      title: '每月结余至少 2,000 元',
      active: true,
      status: '使用中',
      source: '本机已有记忆',
      purpose: '用于生成财务提醒，不自动修改账户。',
      updatedAt: '',
    });
  });

  it('lists health data range evidence missing metrics and a non-diagnosis boundary', () => {
    const briefing = buildHealthBriefing([
      { kind: 'height', value: 172, createdAt: '2026-08-01' },
      { kind: 'sleep', value: 6.5, createdAt: '2026-08-29' },
    ], true);
    expect(briefing.allowed).toBe(true);
    expect(briefing.rangeLabel).toContain('2026-08-01');
    expect(briefing.rangeLabel).toContain('2026-08-29');
    expect(briefing.evidence).toContain('身高172cm');
    expect(briefing.evidence).toContain('睡眠6.5小时');
    expect(briefing.missing).toEqual(expect.arrayContaining(['体重', '心率', '压力', 'PAI', '步数']));
    expect(briefing.disclaimer).toContain('不是诊断');
  });

  it('keeps passwords out of the butler prompt and withholds health evidence when permission is off', () => {
    const prompt = buildButlerSystemPrompt({
      today: '2026-08-29',
      month: '2026-08',
      privacy: { schedule: true, finance: true, health: false },
      schedules: [{ date: '2026-08-29', done: false, title: '周会' }],
      transactions: [{ createdAt: '2026-08-29' }],
      healthRecords: [{ kind: 'heartRate', value: 62, createdAt: '2026-08-29' }],
      memories: [{ active: true, title: '每月还债', note: '优先完成', source: '用户确认', purpose: '财务提醒', updatedAt: '2026-08-20' }],
      vaultItems: [{ title: '邮箱', password: 'hunter2' }],
    });
    expect(prompt).toContain('日程未完成=周会');
    expect(prompt).toContain('健康权限关闭');
    expect(prompt).not.toContain('hunter2');
    expect(prompt).not.toContain('心率62');
    expect(prompt).toContain('create_schedule');
    expect(prompt).toContain('只能返回草稿');
    expect(prompt).toContain('不是诊断');
  });
});

describe('truthful product state', () => {
  it('does not leak disabled schedule data into the AI summary', () => {
    const summary = buildScopedSummary({
      today: '2026-08-29',
      month: '2026-08',
      privacy: { schedule: false, finance: false, health: false },
      schedules: [{ date: '2026-08-29', done: false, title: '秘密日程' }],
      transactions: [{ createdAt: '2026-08-29' }],
      healthRecords: [{ id: 'h1' }],
      memories: [{ active: true, title: '每月还债', note: '优先完成' }],
    });

    expect(summary).toContain('日程权限关闭');
    expect(summary).not.toContain('秘密日程');
    expect(summary).toContain('每月还债');
  });

  it('summarizes latest height weight heart rate stress sleep and PAI for AI', () => {
    expect(summarizeHealth([
      { kind: 'height', value: 170, createdAt: '2026-01-01' },
      { kind: 'height', value: 172, createdAt: '2026-08-01' },
      { kind: 'weight', value: 68.5, createdAt: '2026-08-28' },
      { kind: 'heartRate', value: 62, createdAt: '2026-08-29' },
      { kind: 'stress', value: 41, createdAt: '2026-08-29' },
      { kind: 'sleep', value: 6.5, createdAt: '2026-08-29' },
      { kind: 'pai', value: 88, createdAt: '2026-08-29' },
    ])).toBe('身高172cm，体重68.5kg，心率62次/分，压力41，睡眠6.5小时，PAI88');
  });

  it('maps health-connect snapshots into typed records the AI can read', () => {
    const records = healthRecordsFromSnapshots([{
      date: '2026-08-29',
      source: 'health-connect',
      sleepHours: 7.2,
      heightCm: 172,
      weightKg: 68.5,
      heartRate: 61,
      stress: 35,
      pai: 90,
      steps: 3344,
    }]);
    expect(records.map((item) => item.kind)).toEqual(['height', 'weight', 'heartRate', 'stress', 'sleep', 'pai', 'steps']);
    expect(buildScopedSummary({
      today: '2026-08-29',
      month: '2026-08',
      privacy: { schedule: true, finance: true, health: true },
      schedules: [],
      transactions: [],
      healthRecords: records,
      memories: [],
    })).toContain('身高172cm，体重68.5kg，心率61次/分，压力35，睡眠7.2小时，PAI90');
  });

  it('recognizes the legacy bundled sample instead of presenting it as real data', () => {
    expect(detectLegacyDemoData({ schedules: [{ id: 's1' }], accounts: [{ id: 'wechat' }] })).toBe(true);
    expect(detectLegacyDemoData({ schedules: [], accounts: [] })).toBe(false);
  });

  it('accepts a structured backup and rejects malformed data before replacement', () => {
    expect(isBackupPayload({ schedules: [], accounts: [], transactions: [] })).toBe(true);
    expect(isBackupPayload({ schedules: 'not-an-array', accounts: [], transactions: [] })).toBe(false);
    expect(isBackupPayload(null)).toBe(false);
  });

  it('sums every account into one total-assets view without dropping other currencies', () => {
    expect(assetTotals([])).toEqual([]);
    expect(assetTotals([
      { currency: 'CNY', balance: 1200.5 },
      { currency: 'CNY', balance: -80 },
      { currency: 'USD', balance: 99 },
    ])).toEqual([
      { currency: 'CNY', amount: 1120.5 },
      { currency: 'USD', amount: 99 },
    ]);
  });

  it('treats reimbursement as receivable and 欠款 as payable debt', () => {
    expect(accountRole('待收回')).toBe('receivable');
    expect(accountRole('欠款')).toBe('payable');
    expect(accountRole('信用卡')).toBe('liability');
    expect(wealthTotals([
      { type: '资金账户', currency: 'CNY', balance: 1000 },
      { type: '待收回', currency: 'CNY', balance: 36 },
      { type: '欠款', currency: 'CNY', balance: 80 },
      { type: '信用卡', currency: 'CNY', balance: -200 },
    ])).toEqual([{ currency: 'CNY', assets: 1000, receivable: 36, liability: 280, payable: 280, net: 756 }]);
  });

  it('plans a partial 待收回 collection into a chosen cash account', () => {
    const accounts = [
      { id: 'claim', type: '待收回', currency: 'CNY', balance: 100 },
      { id: 'wechat', type: '资金账户', currency: 'CNY', balance: 20 },
    ];
    const plan = planAccountSettlement(accounts, 'claim', 'wechat', 40);
    expect(plan).toMatchObject({ ok: true, transaction: { kind: 'transfer', accountId: 'claim', targetAccountId: 'wechat', accountAmount: 40 } });
    const next = applyLedger(accounts, plan.ok ? plan.transaction : { kind: 'transfer', accountId: 'claim', targetAccountId: 'wechat', accountAmount: 0 }, 1);
    expect(next.find((item) => item.id === 'claim')?.balance).toBe(60);
    expect(next.find((item) => item.id === 'wechat')?.balance).toBe(60);
  });

  it('plans a partial credit-card repayment from a chosen cash account', () => {
    const accounts = [
      { id: 'card', type: '信用卡', currency: 'CNY', balance: 200 },
      { id: 'bank', type: '储蓄卡', currency: 'CNY', balance: 80 },
    ];
    const plan = planAccountSettlement(accounts, 'card', 'bank', 50);
    expect(plan).toMatchObject({ ok: true, transaction: { kind: 'transfer', accountId: 'bank', targetAccountId: 'card', accountAmount: 50 } });
    const next = applyLedger(accounts, plan.ok ? plan.transaction : { kind: 'transfer', accountId: 'bank', targetAccountId: 'card', accountAmount: 0 }, 1);
    expect(next.find((item) => item.id === 'card')?.balance).toBe(150);
    expect(next.find((item) => item.id === 'bank')?.balance).toBe(30);
  });

  it('rejects a 待收回 collection larger than the open receivable', () => {
    const accounts = [
      { id: 'claim', type: '待收回', currency: 'CNY', balance: 30 },
      { id: 'wechat', type: '资金账户', currency: 'CNY', balance: 100 },
    ];
    expect(planAccountSettlement(accounts, 'claim', 'wechat', 40).ok).toBe(false);
  });

  it('clears a stale monthly-bill confirmation when the posting is already gone', () => {
    const rules = reconcileRecurringConfirmations(
      [{ id: 'netflix', lastRunPeriod: '2026-08' }],
      [],
    );
    expect(rules[0]?.lastRunPeriod).toBeUndefined();
  });

  it('reopens a monthly bill after its confirmed posting is deleted', () => {
    const rules = [{ id: 'netflix', lastRunPeriod: '2026-08' }];
    const remaining = releaseRecurringConfirmation(
      rules,
      [],
      { recurringRuleId: 'netflix', createdAt: '2026-08-05T10:00:00' },
    );
    expect(remaining[0]?.lastRunPeriod).toBeUndefined();
  });

  it('keeps the monthly-bill confirmation if another posting for that period remains', () => {
    const rules = [{ id: 'netflix', lastRunPeriod: '2026-08' }];
    const remaining = releaseRecurringConfirmation(
      rules,
      [{ recurringRuleId: 'netflix', createdAt: '2026-08-06T10:00:00' }],
      { recurringRuleId: 'netflix', createdAt: '2026-08-05T10:00:00' },
    );
    expect(remaining[0]?.lastRunPeriod).toBe('2026-08');
  });

  it('credits a 待收回 claim account when a reimbursable WeChat expense is posted', () => {
    const accounts = [
      { id: 'wechat', type: '资金账户', currency: 'CNY', balance: 200 },
      { id: 'claim', type: '待收回', currency: 'CNY', balance: 0 },
      { id: 'bank', type: '储蓄卡', currency: 'CNY', balance: 10 },
    ];
    const posted = applyLedger(accounts, {
      kind: 'expense',
      accountId: 'wechat',
      accountAmount: 100,
      reimbursable: true,
      reimburseAccountId: 'claim',
    }, 1);
    expect(posted.find((item) => item.id === 'wechat')?.balance).toBe(100);
    expect(posted.find((item) => item.id === 'claim')?.balance).toBe(100);
    expect(posted.find((item) => item.id === 'bank')?.balance).toBe(10);
    expect(wealthTotals(posted, [{ kind: 'expense', currency: 'CNY', accountAmount: 100, reimbursable: true, reimbursed: false, reimburseAccountId: 'claim' }])[0]).toMatchObject({
      assets: 110,
      receivable: 100,
      net: 210,
    });
  });

  it('keeps reimbursement on the payment and deposit accounts instead of a 报销账户', () => {
    const accounts = [
      { id: 'wechat', type: '资金账户', currency: 'CNY', balance: 100 },
      { id: 'bank', type: '储蓄卡', currency: 'CNY', balance: 0 },
    ];
    const posted = applyLedger(accounts, {
      kind: 'expense',
      accountId: 'wechat',
      accountAmount: 36,
      reimbursable: true,
      reimburseAccountId: 'bank',
    }, 1);
    expect(posted.find((item) => item.id === 'wechat')?.balance).toBe(64);
    expect(posted.find((item) => item.id === 'bank')?.balance).toBe(0);
    expect(wealthTotals(posted, [{ kind: 'expense', currency: 'CNY', accountAmount: 36, reimbursable: true, reimbursed: false }])[0]).toMatchObject({
      assets: 64,
      receivable: 36,
      net: 100,
    });
    const repaid = applyLedger(posted, {
      kind: 'income',
      accountId: 'bank',
      accountAmount: 36,
    }, 1);
    expect(repaid.find((item) => item.id === 'wechat')?.balance).toBe(64);
    expect(repaid.find((item) => item.id === 'bank')?.balance).toBe(36);
  });

  it('undoes a reimbursement deposit without losing the pending receivable', () => {
    const paid = [
      { id: 'pay', type: '资金账户', currency: 'CNY', balance: 800 },
      { id: 'deposit', type: '储蓄卡', currency: 'CNY', balance: 100 },
    ];
    const original = { id: 'expense', kind: 'expense' as const, accountId: 'pay', accountAmount: 200, reimbursable: true, reimbursed: false };
    const credit = { id: 'credit', kind: 'income' as const, accountId: 'deposit', accountAmount: 200 };
    const settled = settleReimbursementState(paid, [original], original.id, credit);
    expect(settled.accounts.find((item) => item.id === 'deposit')?.balance).toBe(300);
    expect(settled.transactions.find((item) => item.id === original.id)).toMatchObject({ reimbursed: true, reimbursementTransactionId: 'credit' });
    expect(settled.transactions.find((item) => item.id === credit.id)).toMatchObject({ reimbursementForId: 'expense' });

    const undone = removeLedgerTransactionState(settled.accounts, settled.transactions, credit.id);
    expect(undone.accounts.find((item) => item.id === 'deposit')?.balance).toBe(100);
    expect(undone.transactions.find((item) => item.id === original.id)).toMatchObject({ reimbursed: false });
  });

  it('removes both sides when deleting an already reimbursed expense', () => {
    const paid = [
      { id: 'pay', type: '资金账户', currency: 'CNY', balance: 800 },
      { id: 'deposit', type: '储蓄卡', currency: 'CNY', balance: 300 },
    ];
    const original = { id: 'expense', kind: 'expense' as const, accountId: 'pay', accountAmount: 200, reimbursable: true, reimbursed: true, reimbursementTransactionId: 'credit' };
    const credit = { id: 'credit', kind: 'income' as const, accountId: 'deposit', accountAmount: 200, reimbursementForId: 'expense' };
    const removed = removeLedgerTransactionState(paid, [credit, original], original.id);
    expect(removed.accounts.find((item) => item.id === 'pay')?.balance).toBe(1000);
    expect(removed.accounts.find((item) => item.id === 'deposit')?.balance).toBe(100);
    expect(removed.transactions).toEqual([]);
  });

  it('resolves an auto-ledger hint to the actual user-created payment account', () => {
    const accounts = [
      { id: 'account-random', name: '我的支付宝', type: '资金账户', currency: 'CNY', balance: 500 },
      { id: 'object', name: '笔记本电脑', type: '物品资产', currency: 'CNY', balance: 5000 },
    ];
    expect(resolvePaymentAccountId(accounts, 'alipay', '支付宝')).toBe('account-random');
    expect(resolvePaymentAccountId([accounts[1]], 'alipay', '支付宝')).toBeUndefined();
  });

  it('does not use a physical asset as a default cash account', () => {
    expect(defaultCashId([{ id: 'object', name: '电脑', type: '物品资产', currency: 'CNY', balance: 5000 }], 'CNY')).toBeUndefined();
  });

  it('converts all wealth to CNY only with a dated rate and leaves unknown currency out', () => {
    const accounts = [
      { id: 'cny', type: '资金账户', currency: 'CNY', balance: 100 },
      { id: 'usd', type: '储蓄卡', currency: 'USD', balance: 100 },
    ];
    expect(cnyWealthTotal(accounts, [])).toEqual({ convertedCny: 100, unresolved: [{ currency: 'USD', amount: 100 }] });
    expect(cnyWealthTotal(accounts, [], [{ currency: 'USD', cnyRate: 7.2, asOf: '2026-08-29', source: 'manual', updatedAt: '2026-08-29T12:00:00' }])).toEqual({ convertedCny: 820, unresolved: [] });
    expect(cnyWealthTotal(accounts, [], [{ currency: 'USD', cnyRate: 7.2, asOf: '', source: 'manual', updatedAt: '2026-08-29T12:00:00' }])).toEqual({ convertedCny: 100, unresolved: [{ currency: 'USD', amount: 100 }] });
  });

  it('migrates a legacy reimbursement balance without counting linked expenses twice', () => {
    const migrated = migrateLegacyReimbursementAccounts(
      [
        { id: 'cash', type: '资金账户', currency: 'CNY', balance: 800 },
        { id: 'legacy-reimburse', type: '报销账户', currency: 'CNY', balance: 200 },
      ],
      [{ id: 'expense', kind: 'expense', currency: 'CNY', accountAmount: 200, reimbursable: true, reimbursed: false, reimburseAccountId: 'legacy-reimburse' }],
    );
    expect(migrated.accounts).toEqual([{ id: 'cash', type: '资金账户', currency: 'CNY', balance: 800 }]);
    expect(migrated.transactions[0]).toMatchObject({ reimbursable: true, reimbursed: false, reimburseAccountId: undefined });
    expect(wealthTotals(migrated.accounts, migrated.transactions)).toEqual([{ currency: 'CNY', assets: 800, receivable: 200, liability: 0, payable: 0, net: 1000 }]);
  });

  it('upserts native imports by stable external key', () => {
    const result = upsertByExternalKey(
      [{ id: 'old', externalKey: 'health:2026-08-29:steps', value: 12 }, { id: 'manual', value: 8 }],
      [{ id: 'new', externalKey: 'health:2026-08-29:steps', value: 15 }],
    );
    expect(result).toEqual([{ id: 'new', externalKey: 'health:2026-08-29:steps', value: 15 }, { id: 'manual', value: 8 }]);
  });

  it('upserts a daily CNY rate without touching other currencies', () => {
    const next = applyDailyFxRates(
      [{ currency: 'USD', cnyRate: 7.1, asOf: '2026-08-28', source: 'manual', updatedAt: '2026-08-28T12:00:00' }, { currency: 'EUR', cnyRate: 8.1, asOf: '2026-08-28', source: 'manual', updatedAt: '2026-08-28T12:00:00' }],
      [{ currency: 'USD', cnyRate: 6.72, asOf: '2026-08-29', source: 'daily', updatedAt: '2026-08-29T18:00:00' }],
    );
    expect(next).toEqual([{ currency: 'USD', cnyRate: 6.72, asOf: '2026-08-29', source: 'daily', updatedAt: '2026-08-29T18:00:00' }, { currency: 'EUR', cnyRate: 8.1, asOf: '2026-08-28', source: 'manual', updatedAt: '2026-08-28T12:00:00' }]);
  });

  it('replaces the same daily price point without altering the prior close', () => {
    const next = applyDailyPriceQuotes(
      [{ id: 'etf', currentPrice: 10, updatedAt: '2026-08-28', quoteStatus: 'manual', history: [{ date: '08-28', price: 10 }] }],
      [{ holdingId: 'etf', price: 12.5, asOf: '2026-08-29T18:00:00', source: 'stooq' }],
    );
    expect(next).toEqual([{ id: 'etf', currentPrice: 12.5, updatedAt: '2026-08-29T18:00:00', quoteStatus: 'live', history: [{ date: '08-28', price: 10 }, { date: '08-29', price: 12.5 }] }]);
  });

  it('rejects a debt payment that exceeds the open balance', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', balance: 100 },
      { id: 'debt', type: '欠款', currency: 'CNY', balance: 50 },
    ];
    const payment = { kind: 'transfer' as const, accountId: 'cash', targetAccountId: 'debt', accountAmount: 80 };
    expect(canApplyLedger(accounts, payment)).toBe(false);
  });

  it('repaying 欠款 reduces debt instead of counting it as an asset', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', balance: 200 },
      { id: 'owe', type: '欠款', currency: 'CNY', balance: 80 },
    ];
    const next = applyLedger(accounts, {
      kind: 'transfer',
      accountId: 'cash',
      targetAccountId: 'owe',
      accountAmount: 80,
    }, 1);
    expect(next.find((item) => item.id === 'cash')?.balance).toBe(120);
    expect(next.find((item) => item.id === 'owe')?.balance).toBe(0);
    expect(wealthTotals(next)[0].net).toBe(120);
  });
});


function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem(key: string) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    snapshot() { return { ...store }; },
  };
}

describe('AI API key storage migration', () => {
  it('strips apiKey from localStorage and returns the secret once for native or session handoff', () => {
    const local = memoryStorage({
      [AI_CONFIG_STORAGE_KEY]: JSON.stringify({ baseUrl: 'https://api.openai.com/v1/', model: 'gpt-4o-mini', apiKey: 'sk-test' }),
    });
    const migrated = migrateLegacyAiLocalStorage(local);
    expect(migrated).toEqual({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-test' });
    expect(local.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('persists browser AI config in session storage without writing apiKey to localStorage', () => {
    const session = memoryStorage();
    const local = memoryStorage({
      [AI_CONFIG_STORAGE_KEY]: JSON.stringify({ apiKey: 'sk-old', password: 'vault-secret' }),
    });
    const published = persistBrowserAiConfig(session, local, { baseUrl: 'https://api.openai.com/v1/', model: '', apiKey: 'sk-new' });
    expect(published).toEqual({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', configured: true });
    expect(JSON.parse(session.getItem(AI_CONFIG_STORAGE_KEY)!)).toEqual({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-new',
    });
    expect(local.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();
    expect(JSON.stringify(published)).not.toMatch(/apiKey|sk-new|password|vault/i);
  });

  it('reloads browser config from session storage and never from leftover localStorage secrets', () => {
    const session = memoryStorage({
      [AI_CONFIG_STORAGE_KEY]: JSON.stringify({ baseUrl: 'https://example.test/v1', model: 'demo', apiKey: 'sk-session' }),
    });
    const local = memoryStorage({
      [AI_CONFIG_STORAGE_KEY]: JSON.stringify({ baseUrl: 'https://evil.test', apiKey: 'sk-local', password: 'hunter2' }),
    });
    expect(loadBrowserAiConfig(session, local)).toEqual({
      baseUrl: 'https://example.test/v1',
      model: 'demo',
      apiKey: 'sk-session',
      configured: true,
    });
    expect(local.getItem(AI_CONFIG_STORAGE_KEY)).toBeNull();
  });

  it('builds versioned AI events that never include the API key or vault fields', () => {
    const reply = versionedAiEvent({ requestId: 'r1', ok: true, content: 'hi' });
    const status = versionedAiEvent({ configured: true, baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', hasKey: true });
    expect(reply.v).toBe(AI_EVENT_VERSION);
    expect(status.v).toBe(1);
    expect(publicAiConfig({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-secret', password: 'x' })).toEqual({
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      configured: true,
    });
    expect(JSON.stringify(reply)).not.toMatch(/apiKey|password|vault/i);
    expect(JSON.stringify(status)).not.toMatch(/apiKey|password|vault/i);
    });
  });

describe('unified inbox normalization', () => {
  it('migrates missing inbox collections and drops secret fields', () => {
    expect(migrateInboxStore({ schedules: [], accounts: [], transactions: [] })).toEqual({ inboxItems: [], lastConfirmedInboxId: null });
    expect(normalizeInboxItems(undefined)).toEqual([]);
    const dirty = normalizeInboxItem({
      id: 'in1',
      source: 'payment',
      proposedAction: 'create_expense',
      confidence: 1.4,
      createdAt: '2026-08-30T10:00:00',
      payload: { amount: 36, merchant: '午饭', password: 'secret123', apiKey: 'sk-test', note: '密码不要外传' },
    });
    expect(dirty).toMatchObject({
      id: 'in1',
      source: 'payment',
      status: 'pending',
      confidence: 1,
      payload: { amount: 36, merchant: '午饭' },
    });
    expect(JSON.stringify(dirty)).not.toMatch(/password|apiKey|sk-test|secret123|密码/);
    expect(sanitizeInboxPayload({ token: 'abc', merchant: '午饭' })).toEqual({ merchant: '午饭' });
    expect(normalizeInboxItem({ id: 'bad', source: 'sms', proposedAction: 'create_expense', payload: { amount: 1 } })).toBeNull();
  });

  it('labels every supported capture source in Chinese', () => {
    expect(inboxSourceLabel('payment')).toBe('支付通知');
    expect(inboxSourceLabel('travel')).toBe('行程更新');
    expect(inboxSourceLabel('ocr')).toBe('图片识别');
    expect(inboxSourceLabel('voice')).toBe('语音');
    expect(inboxSourceLabel('manual')).toBe('手动输入');
    expect(inboxSourceLabel('ai')).toBe('管家建议');
    expect(inboxConfidenceLabel(0.82)).toBe('82%');
  });
});

describe('unified inbox state transitions', () => {
  it('moves pending items to confirmed or ignored and only reopens ledger confirms', () => {
    const seed = inboxItemFromPayment({ id: 'pay-1', createdAt: '2026-08-30T10:00:00', amount: 36, merchant: '午饭', accountId: 'wechat' });
    expect(seed.status).toBe('pending');
    const ignored = ignoreInboxItem([seed], 'pay-1');
    expect(ignored[0].status).toBe('ignored');
    expect(confirmInboxItem(ignored, 'pay-1', 'txn-1')[0].status).toBe('ignored');
    const confirmed = confirmInboxItem([seed], 'pay-1', 'txn-1');
    expect(confirmed[0]).toMatchObject({ status: 'confirmed', resultEntityId: 'txn-1' });
    expect(canUndoInboxConfirm(confirmed[0])).toBe(true);
    expect(reopenInboxItem(confirmed, 'pay-1')[0]).toMatchObject({ status: 'pending', resultEntityId: undefined });
    const travel = inboxItemFromTravelNotice({
      id: 'tr-1',
      createdAt: '2026-08-30T10:00:00',
      travel: { kind: 'train', number: 'G11', from: '北京南', to: '上海虹桥', departAt: '2026-08-30T09:00' },
    });
    const confirmedTravel = confirmInboxItem([travel], 'tr-1', 'travel-1');
    expect(canUndoInboxConfirm(confirmedTravel[0])).toBe(false);
    expect(updateInboxItemPayload([seed], 'pay-1', { amount: 40, merchant: '晚餐' })[0].preview).toContain('晚餐');
    expect(pendingInboxCount(confirmed)).toBe(0);
  });
});

describe('unified inbox dedupe', () => {
  it('merges pending payment and travel notices with the same fingerprint', () => {
    const first = inboxItemFromPayment({ id: 'pay-a', createdAt: '2026-08-30T10:00:00', amount: 18.5, merchant: '地铁', accountId: 'alipay', fingerprint: 'pay:18.5:地铁' });
    const second = inboxItemFromPayment({ id: 'pay-b', createdAt: '2026-08-30T10:01:00', amount: 18.5, merchant: '地铁', accountId: 'alipay', fingerprint: 'pay:18.5:地铁' });
    const merged = enqueueInboxItem([first], second);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('pay-a');
    expect(pendingInboxCount(merged)).toBe(1);
    const tripA = inboxItemFromTravelNotice({
      id: 'tr-a',
      createdAt: '2026-08-30T10:00:00',
      travel: { kind: 'train', number: 'G123', from: '北京南', to: '上海虹桥', departAt: '2026-08-31T09:00:00' },
    });
    const tripB = inboxItemFromTravelNotice({
      id: 'tr-b',
      createdAt: '2026-08-30T10:02:00',
      travel: { kind: 'train', number: 'G123', from: '北京南', to: '上海虹桥', departAt: '2026-08-31T09:00:00' },
    });
    expect(enqueueInboxItem([tripA], tripB)).toHaveLength(1);
    const confirmed = confirmInboxItem([first], 'pay-a', 'txn-a');
    const again = enqueueInboxItem(confirmed, second);
    expect(again).toHaveLength(2);
    expect(pendingInboxCount(again)).toBe(1);
  });

  it('keeps parsed capture and butler drafts in the same pending queue', () => {
    const capture = inboxItemFromNaturalCapture({
      id: 'cap-1',
      source: 'voice',
      createdAt: '2026-08-30T10:00:00',
      parsed: parseNaturalCapture('午饭 36 元，微信支付', '2026-08-30'),
      accountId: 'wechat',
    });
    const butler = inboxItemFromButlerAction({
      id: 'ai-1',
      createdAt: '2026-08-30T10:01:00',
      action: { type: 'create_schedule', payload: { title: '吃药', date: '2026-08-31', time: '09:00' } },
    });
    expect(capture.source).toBe('voice');
    expect(capture.proposedAction).toBe('create_expense');
    expect(butler?.proposedAction).toBe('create_schedule');
    expect(pendingInboxCount(enqueueInboxItem([capture], butler))).toBe(2);

  });
});

describe('v2 audit log sanitization and retention', () => {
  it('normalizes typed append-only entries and never keeps password/apiKey/token/vault payloads', () => {
    expect(migrateAuditLog(undefined)).toEqual([]);
    expect(migrateAuditLog({ auditLog: [{ id: 'bad', source: 'sms', outcome: 'hacked', action: 'leak' }] })).toEqual([]);
    const entries = appendAuditEntry([], {
      id: 'aud-1',
      timestamp: '2026-08-30T10:00:00',
      source: 'payment',
      action: 'create_expense',
      itemId: 'pay-1',
      outcome: 'pending',
      summary: '午饭 · 36',
      reason: 'queued',
      password: 'secret123',
      apiKey: 'sk-test',
      token: 'abc',
      vault: { pin: '1234' },
      payload: { amount: 36, password: 'secret123', apiKey: 'sk-test' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'aud-1',
      timestamp: '2026-08-30T10:00:00',
      source: 'payment',
      action: 'create_expense',
      itemId: 'pay-1',
      outcome: 'pending',
      summary: '午饭 · 36',
    });
    expect(JSON.stringify(entries)).not.toMatch(/password|apiKey|sk-test|token|vault|secret123|1234/i);
  });

  it('appends newest first and caps local retention', () => {
    let log = migrateAuditLog([]);
    for (let index = 0; index < AUDIT_LOG_LIMIT + 5; index += 1) {
      log = appendAuditEntry(log, {
        id: `aud-${index}`,
        timestamp: `2026-08-30T10:00:${String(index).padStart(2, '0')}`,
        source: 'manual',
        action: 'create_schedule',
        itemId: `item-${index}`,
        outcome: 'pending',
        summary: `条目 ${index}`,
      });
    }
    expect(log).toHaveLength(AUDIT_LOG_LIMIT);
    expect(log[0].id).toBe(`aud-${AUDIT_LOG_LIMIT + 4}`);
    expect(log.at(-1)?.id).toBe('aud-5');
  });
});

describe('v2 audit log inbox lifecycle', () => {
  it('records enqueue, butler proposal, confirm, ignore and undo without double entries', () => {
    const payment = inboxItemFromPayment({ id: 'pay-1', createdAt: '2026-08-30T10:00:00', amount: 36, merchant: '午饭', accountId: 'wechat' });
    let store = { inboxItems: [] as ReturnType<typeof enqueueInboxItem>, auditLog: migrateAuditLog([]) };
    store = applyInboxLifecycle(store, { type: 'enqueue', item: payment, timestamp: '2026-08-30T10:00:00', id: 'aud-e1' });
    store = applyInboxLifecycle(store, { type: 'enqueue', item: { ...payment, id: 'pay-dup' }, timestamp: '2026-08-30T10:00:01', id: 'aud-e1b' });
    expect(store.inboxItems).toHaveLength(1);
    expect(store.auditLog.filter((entry) => entry.outcome === 'pending' && entry.itemId === 'pay-1')).toHaveLength(1);

    const butler = inboxItemFromButlerAction({
      id: 'ai-1',
      createdAt: '2026-08-30T10:01:00',
      action: { type: 'create_schedule', payload: { title: '吃药', date: '2026-08-31', time: '09:00' } },
    });
    store = applyInboxLifecycle(store, { type: 'enqueue', item: butler, timestamp: '2026-08-30T10:01:00', id: 'aud-b1' });
    store = applyInboxLifecycle(store, { type: 'enqueue', item: butler, timestamp: '2026-08-30T10:01:01', id: 'aud-b1b' });
    expect(store.auditLog.filter((entry) => entry.source === 'ai' && entry.outcome === 'pending')).toHaveLength(1);

    store = applyInboxLifecycle(store, { type: 'confirm', itemId: 'pay-1', resultEntityId: 'txn-1', timestamp: '2026-08-30T10:02:00', id: 'aud-c1' });
    store = applyInboxLifecycle(store, { type: 'confirm', itemId: 'pay-1', resultEntityId: 'txn-1', timestamp: '2026-08-30T10:02:01', id: 'aud-c1b' });
    expect(store.inboxItems.find((item) => item.id === 'pay-1')).toMatchObject({ status: 'confirmed', resultEntityId: 'txn-1' });
    expect(store.auditLog.filter((entry) => entry.itemId === 'pay-1' && entry.outcome === 'confirmed')).toHaveLength(1);

    store = applyInboxLifecycle(store, { type: 'undo', itemId: 'pay-1', timestamp: '2026-08-30T10:03:00', id: 'aud-u1' });
    expect(store.inboxItems.find((item) => item.id === 'pay-1')?.status).toBe('pending');
    expect(store.auditLog[0]).toMatchObject({ itemId: 'pay-1', outcome: 'undone' });

    store = applyInboxLifecycle(store, { type: 'ignore', itemId: 'ai-1', timestamp: '2026-08-30T10:04:00', id: 'aud-i1' });
    store = applyInboxLifecycle(store, { type: 'ignore', itemId: 'ai-1', timestamp: '2026-08-30T10:04:01', id: 'aud-i1b' });
    expect(store.inboxItems.find((item) => item.id === 'ai-1')?.status).toBe('ignored');
    expect(store.auditLog.filter((entry) => entry.itemId === 'ai-1' && entry.outcome === 'ignored')).toHaveLength(1);
  });

  it('leaves an auditable failed entry for missing amount, missing account, and invalid health', () => {
    const noAmount = inboxItemFromPayment({ id: 'pay-0', createdAt: '2026-08-30T10:00:00', amount: 0, merchant: '午饭', accountId: 'wechat' });
    expect(inboxConfirmBlockReason(noAmount, [{ id: 'wechat' }])).toMatchObject({ reason: 'missing_amount', dataScope: 'finance' });
    const noAccount = inboxItemFromPayment({ id: 'pay-acc', createdAt: '2026-08-30T10:00:00', amount: 12, merchant: '咖啡', accountId: '' });
    expect(inboxConfirmBlockReason(noAccount, [])).toMatchObject({ reason: 'missing_account', dataScope: 'finance' });
    const health = inboxItemFromNaturalCapture({
      id: 'h1',
      source: 'manual',
      createdAt: '2026-08-30T10:00:00',
      parsed: { kind: 'health', metric: 'steps', value: 8000 },
    });
    const invalidHealth = { ...health, payload: { ...health.payload, value: 0 } };
    expect(inboxConfirmBlockReason(invalidHealth, [])).toMatchObject({ reason: 'invalid_health', dataScope: 'health' });

    let store = applyInboxLifecycle({ inboxItems: [noAmount], auditLog: [] }, {
      type: 'fail',
      itemId: 'pay-0',
      reason: 'missing_amount',
      dataScope: 'finance',
      timestamp: '2026-08-30T10:05:00',
      id: 'aud-f1',
    });
    expect(store.inboxItems[0].status).toBe('pending');
    expect(store.auditLog[0]).toMatchObject({ outcome: 'failed', reason: 'missing_amount', dataScope: 'finance', itemId: 'pay-0' });
    expect(JSON.stringify(store.auditLog)).not.toMatch(/password|apiKey|token|vault/i);
  });

  it('filters by status and source with Chinese labels and does not invent undo from history', () => {
    const entries = migrateAuditLog([
      { id: '1', timestamp: 't1', source: 'payment', action: 'create_expense', itemId: 'a', outcome: 'confirmed', summary: '午饭' },
      { id: '2', timestamp: 't2', source: 'ai', action: 'create_schedule', itemId: 'b', outcome: 'pending', summary: '吃药' },
      { id: '3', timestamp: 't3', source: 'payment', action: 'create_expense', itemId: 'a', outcome: 'failed', summary: '午饭', reason: 'missing_amount' },
    ]);
    expect(filterAuditLog(entries, { outcome: 'failed' }).map((entry) => entry.id)).toEqual(['3']);
    expect(filterAuditLog(entries, { source: 'ai' }).map((entry) => entry.id)).toEqual(['2']);
    expect(auditOutcomeLabel('pending')).toBe('待确认');
    expect(auditOutcomeLabel('confirmed')).toBe('已确认');
    expect(auditOutcomeLabel('ignored')).toBe('已忽略');
    expect(auditOutcomeLabel('undone')).toBe('已撤销');
    expect(auditOutcomeLabel('failed')).toBe('失败');
    expect(auditReasonLabel('missing_amount')).toBe('缺少金额');
    expect(auditReasonLabel('missing_account')).toBe('缺少账户');
    expect(auditReasonLabel('invalid_health')).toBe('健康数值无效');
    expect(entries.every((entry) => canUndoAuditEntry(entry) === false)).toBe(true);
  });
});

describe('v2 permission onboarding persistence', () => {
  it('always returns a complete non-secret local storage row', () => {
    expect(normalizePermissionOnboarding(undefined)).toEqual({
      version: 2,
      dismissed: false,
      completedAt: null,
      settingsOpened: false,
    });
    expect(normalizePermissionOnboarding({ dismissed: true, settingsOpened: true, completedAt: '2026-08-30T10:00:00', apiKey: 'secret', password: 'nope' })).toEqual({
      version: 2,
      dismissed: true,
      completedAt: '2026-08-30T10:00:00',
      settingsOpened: true,
    });
    expect(normalizePermissionOnboarding({ version: 1, dismissed: 'yes', completedAt: 12 })).toEqual({
      version: 2,
      dismissed: false,
      completedAt: null,
      settingsOpened: false,
    });
  });

  it('shows dedicated onboarding on first launch and after 我的 reopen, not after 稍后设置', () => {
    const fresh = normalizePermissionOnboarding(undefined);
    expect(shouldShowPermissionOnboarding(fresh)).toBe(true);
    const later = normalizePermissionOnboarding({ dismissed: true });
    expect(shouldShowPermissionOnboarding(later)).toBe(false);
    expect(shouldShowPermissionOnboarding(later, { reopen: true })).toBe(true);
  });

  it('lists four honest cards and never treats opening settings as enabled', () => {
    const cards = permissionOnboardingCards();
    expect(cards.map((card) => card.title)).toEqual(['支付识别', '日程提醒', '健康同步', '密码自动填充']);
    for (const card of cards) {
      expect(card.why.length).toBeGreaterThan(8);
      expect(card.reads.length).toBeGreaterThan(8);
      expect(card.cannotRead.length).toBeGreaterThan(8);
    }
    const opened = permissionOnboardingProgress(
      { accessibility: false, notifications: false, notificationListener: false, autofill: false },
      { settingsOpened: true },
    );
    expect(opened.every((card) => card.enabled === false)).toBe(true);
    const live = permissionOnboardingProgress({
      accessibility: true,
      notificationListener: true,
      notifications: true,
      exactAlarms: true,
      fullScreenIntent: true,
      autofill: true,
    });
    expect(live.find((card) => card.id === 'payment')?.enabled).toBe(true);
    expect(live.find((card) => card.id === 'reminders')?.enabled).toBe(true);
    expect(live.find((card) => card.id === 'autofill')?.enabled).toBe(true);
    expect(live.find((card) => card.id === 'health')?.enabled).toBe(false);
    const partialReminders = permissionOnboardingProgress({ notifications: true });
    expect(partialReminders.find((card) => card.id === 'reminders')?.enabled).toBe(true);
    const unknownExact = permissionOnboardingProgress({ notifications: true, exactAlarms: null, fullScreenIntent: null });
    expect(unknownExact.find((card) => card.id === 'reminders')?.enabled).toBe(true);
  });
});
