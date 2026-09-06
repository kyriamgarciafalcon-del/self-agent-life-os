import { useEffect, useRef, useState } from 'react';
import { getMonthlyReport, transactionsInPeriod } from '../../../finance-query';
import {
  AI_REPLY_EVENT,
  buildAiSendPreview,
  buildButlerSystemPrompt,
  buildHealthBriefing,
  classifyAiProviderError,
  confirmByokHost,
  consumeCallBudget,
  createCallBudget,
  describeButlerDataScope,
  dialogShouldDismiss,
  inboxItemFromAiTool,
  localDateKey,
  parseAiProviderResponse,
  parseButlerModelOutput,
  prepareOutboundAiPayload,
  validateByokTarget,
  type ButlerAction,
} from '../../../product-logic';

type PrivacySettings = { health: boolean; finance: boolean; schedule: boolean; memory: boolean };
type ButlerTxn = { kind?: string; amount?: number; currency?: string; createdAt: string; occurredAt?: string };
type ButlerData = {
  privacy: PrivacySettings;
  healthRecords: Parameters<typeof buildHealthBriefing>[0];
  transactions: ButlerTxn[];
  schedules: { date: string; title: string; done: boolean }[];
  memories: { title: string; note: string; active: boolean; sendAllowed: boolean }[];
};
type AiConfig = { baseUrl: string; model: string; apiKey: string; configured: boolean };
type NativeAiBridge = {
  nativeReady?: () => boolean;
  askAi?: (json: string) => void;
};

function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function askNativeAi(native: NativeAiBridge | undefined, payload: { requestId: string; model: string; messages: { role: string; content: string }[] }): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener(AI_REPLY_EVENT, onReply);
      reject(new Error('timeout'));
    }, 45_000);
    function onReply(event: Event) {
      const detail = (event as CustomEvent<{ v?: number; requestId?: string; ok?: boolean; content?: string; error?: string }>).detail;
      if (!detail || detail.requestId !== payload.requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener(AI_REPLY_EVENT, onReply);
      if (detail.ok && detail.content) resolve(detail.content);
      else reject(new Error(detail?.error || 'offline'));
    }
    window.addEventListener(AI_REPLY_EVENT, onReply);
    native?.askAi?.(JSON.stringify(payload));
  });
}

function formatHealthAnswer(briefing: { rangeLabel: string; evidence: string; missing: string[]; disclaimer: string }, extra = '') {
  const missing = briefing.missing.length ? briefing.missing.join('、') : '无';
  return [extra, `数据范围：${briefing.rangeLabel}`, `证据：${briefing.evidence}`, `缺失指标：${missing}`, briefing.disclaimer].filter(Boolean).join('\n');
}

export function ButlerPage({
  data,
  ai,
  onQueueActions,
  onQueueTools,
}: {
  data: ButlerData;
  ai: AiConfig;
  onQueueActions: (actions: ButlerAction[]) => void;
  onQueueTools: (tools: Parameters<typeof inboxItemFromAiTool>[0]['tool'][]) => void;
}) {
  const TODAY = localDateKey();
  const MONTH = TODAY.slice(0, 7);
  const connected = Boolean(ai.baseUrl && ai.configured);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkState, setLinkState] = useState<'unconfigured' | 'ready' | 'busy' | 'offline'>(connected ? 'ready' : 'unconfigured');
  const [pending, setPending] = useState<ButlerAction[]>([]);
  const [confirmSend, setConfirmSend] = useState<{ text: string; preview: ReturnType<typeof buildAiSendPreview> } | null>(null);
  const [confirmedHost, setConfirmedHost] = useState('');
  const budgetRef = useRef(createCallBudget({ maxCalls: 20, maxTokens: 4096, timeoutMs: 15_000 }));
  const confirmDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmReturnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!confirmSend) return;
    confirmReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = confirmDialogRef.current?.querySelector<HTMLElement>('input,button');
    focusable?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (!dialogShouldDismiss(event.key)) return;
      setConfirmSend(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      confirmReturnFocus.current?.focus?.();
    };
  }, [confirmSend]);

  const briefing = buildHealthBriefing(data.healthRecords, data.privacy.health);
  const scopes = describeButlerDataScope(data.privacy);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([{
    role: 'bot',
    text: connected ? '已连接你配置的 AI 接口。我只会发送允许的摘要，不会读取密码。写操作都要你确认。' : '尚未配置 AI 接口时，我使用本机规则摘要。密码永远不会进入请求。',
  }]);

  function localAnswer(text: string) {
    if (/密码|验证码|私钥|助记词/.test(text)) return '密码库是独立安全域。我不能读取或复述密码、验证码、私钥和助记词。这个问题不会发给 AI。';
    if (/睡眠|疲惫|健康|心率|压力|PAI|身高|体重|步数/.test(text)) {
      if (!data.privacy.health) return formatHealthAnswer(briefing, '健康摘要权限已关闭，不会把健康记录发给 AI。');
      return formatHealthAnswer(briefing, briefing.evidence.startsWith('尚无') ? '还没有足够的健康记录。可在健康页添加或导入手环。' : '以下是本机健康摘要。');
    }
    if (/财务|花|钱|结余/.test(text)) {
      if (!data.privacy.finance) return '财务摘要权限已关闭。你可以在隐私与权限中重新开启。';
      const monthReport = getMonthlyReport(transactionsInPeriod(data.transactions, MONTH), 'CNY');
      return `本月已确认收入 ${money(monthReport.income)} 元、支出 ${money(monthReport.expense)} 元，结余 ${money(monthReport.balance)} 元。未读取订单号或密码。财务不是投资建议。`;
    }
    if (/记忆/.test(text)) {
      if (!data.privacy.memory) return '记忆摘要权限已关闭。你可以在隐私与权限中单独开启，并按条允许发送。';
      const allowed = data.memories.filter((item) => item.active && item.sendAllowed);
      return allowed.length ? `当前允许发送的记忆：${allowed.map((item) => item.title).join('、')}。修改需要确认管家动作。` : '还没有允许发送给 AI 的记忆。';
    }
    if (!data.privacy.schedule) return '日程摘要权限已关闭。你可以在隐私与权限中重新开启。';
    const open = data.schedules.filter((item) => item.date === TODAY && !item.done);
    return open.length ? `建议先处理“${open[0].title}”，完成后再安排下一项。` : '今天没有未完成日程，可以保留一点空白。';
  }

  async function dispatchAi(value: string) {
    setBusy(true); setLinkState('busy');
    let reply = localAnswer(value);
    const system = buildButlerSystemPrompt({ today: TODAY, month: MONTH, privacy: data.privacy, schedules: data.schedules, transactions: data.transactions, healthRecords: data.privacy.health ? data.healthRecords : [], memories: data.memories });
    const outbound = prepareOutboundAiPayload({ userMessage: value, fields: { system } });
    if (!outbound.ok || !outbound.messages) {
      setMessages((current) => [...current, { role: 'bot', text: '检测到密码、令牌、验证码、私钥、助记词或完整卡号，这条消息不会发给 AI。' }]);
      setBusy(false); setLinkState(connected ? 'ready' : 'unconfigured');
      return;
    }
    const target = validateByokTarget(ai.baseUrl);
    if (!target.ok) {
      setMessages((current) => [...current, { role: 'bot', text: 'AI 接口地址不安全：只允许 HTTPS 公网主机，禁止 localhost/内网/链路本地地址。' }]);
      setBusy(false); setLinkState('offline');
      return;
    }
    const budget = consumeCallBudget(budgetRef.current, 256);
    if (!budget.ok) {
      setMessages((current) => [...current, { role: 'bot', text: '已达到本次会话的调用或 token 上限。' }]);
      setBusy(false); setLinkState('ready');
      return;
    }
    try {
      const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative;
      const request = { requestId: uid('ai'), model: ai.model || 'gpt-4o-mini', messages: outbound.messages };
      let content = '';
      if (native?.nativeReady?.() && native.askAi) {
        content = await askNativeAi(native, request);
      } else {
        throw new Error('native_keystore_required');
      }
      const parsed = parseAiProviderResponse(content || reply);
      reply = parsed.reply || reply;
      if (parsed.tools.length) {
        onQueueTools(parsed.tools);
        reply = `${reply}\n\n已放入收件箱 ${parsed.tools.filter((item) => item.name !== 'read_finance_summary').length} 条，确认后才会写入。`;
      } else {
        const fallback = parseButlerModelOutput(content || reply);
        if (fallback.actions.length) {
          onQueueActions(fallback.actions);
          reply = `${fallback.reply}\n\n已放入收件箱 ${fallback.actions.length} 条，确认后才会写入。`;
        }
      }
      if (/健康|心率|睡眠|压力|PAI|身高|体重|步数/.test(value) && !reply.includes('不是诊断')) reply = formatHealthAnswer(briefing, reply);
      setLinkState('ready');
    } catch (error) {
      const classified = classifyAiProviderError({ message: String(error) });
      reply = String(error).includes('native_keystore_required')
        ? `${reply}\n\n外部 AI 只能通过 Android Keystore 通道发送，浏览器直连已关闭。`
        : `${reply}\n\n（${classified.action}）`;
      setLinkState('offline');
    }
    setPending([]);
    setMessages((current) => [...current, { role: 'bot', text: reply }]);
    setBusy(false);
  }

  async function send(text = input) {
    const value = text.trim(); if (!value || busy) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', text: value }]);
    if (/密码|验证码|私钥|助记词/.test(value) || !prepareOutboundAiPayload({ userMessage: value }).ok) {
      setMessages((current) => [...current, { role: 'bot', text: localAnswer(value).includes('密码库') ? localAnswer(value) : '检测到敏感数据，这条消息不会发给 AI。' }]);
      return;
    }
    if (connected) {
      setConfirmSend({ text: value, preview: buildAiSendPreview({ privacy: data.privacy, memories: data.memories, baseUrl: ai.baseUrl }) });
      setConfirmedHost('');
      return;
    }
    setMessages((current) => [...current, { role: 'bot', text: localAnswer(value) }]);
  }

  function confirmOutbound() {
    if (!confirmSend) return;
    if (!confirmByokHost(ai.baseUrl, confirmedHost)) {
      setMessages((current) => [...current, { role: 'bot', text: `请精确确认目标主机 ${confirmSend.preview.domain}，不会发送。` }]);
      return;
    }
    const pendingText = confirmSend.text;
    setConfirmSend(null);
    void dispatchAi(pendingText);
  }

  const statusLabel = busy || linkState === 'busy' ? '正在连接' : linkState === 'offline' ? '接口不可用，已回退本机规则' : connected ? '已配置，可连接' : '未配置，使用本机规则';
  const quick = [
    { label: '安排日程', text: '帮我安排明天上午的日程' },
    { label: '记健康', text: '帮我记下今天的健康数据' },
    { label: '分析健康', text: '分析最近的健康记录' },
    { label: '管理记忆', text: '帮我查看并管理记忆' },
  ];

  return (
    <div className="page mine-surface butler-page">
      <header className="sa-page-header">
        <h1>本机管家</h1>
        <p>{statusLabel}。写操作只会进入收件箱，密码域不会发给 AI。</p>
      </header>

      <section className="sa-card">
        <strong>AI 连接状态</strong>
        <p>{statusLabel}</p>
        <small>{connected ? (ai.model || 'gpt-4o-mini') : '不会调用外部接口'}</small>
      </section>

      <p className="sa-group-header">当前允许的数据域</p>
      <div className="sa-group">
        {scopes.map((item) => (
          <div className="sa-row" key={item.key}>
            <span className={`sa-row-icon ${item.allowed ? 'mint' : 'gray'}`} aria-hidden="true">{item.label.slice(0, 1)}</span>
            <span className="sa-row-text">
              <strong>{item.label}</strong>
              <small>{item.allowed ? '开 · 可发送摘要' : '关 · 不会发送'}</small>
            </span>
          </div>
        ))}
      </div>

      <section className="sa-card">
        <strong>健康回答边界</strong>
        <p>数据范围：{briefing.rangeLabel}</p>
        <p>缺失指标：{briefing.missing.length ? briefing.missing.join('、') : '无'}</p>
        <p>{briefing.disclaimer}</p>
      </section>

      <p className="sa-group-header">快捷提问</p>
      <div className="sa-group">
        {quick.map((item) => (
          <button type="button" className="sa-row" key={item.label} onClick={() => void send(item.text)}>
            <span className="sa-row-text"><strong>{item.label}</strong></span>
            <span className="sa-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      <section className="sa-card butler-chat">
        {messages.map((message, index) => (
          <div key={index} className={`butler-bubble ${message.role}`}>{message.text}</div>
        ))}
      </section>

      {confirmSend ? (
        <div ref={confirmDialogRef} className="overlay" role="dialog" aria-modal="true" aria-label="发送前确认">
          <button type="button" className="sa-sheet-backdrop" aria-label="关闭" onClick={() => setConfirmSend(null)} />
          <form className="sheet" onSubmit={(event) => { event.preventDefault(); confirmOutbound(); }}>
            <div className="handle" />
            <header>
              <h2>发送前确认</h2>
              <button type="button" onClick={() => setConfirmSend(null)} aria-label="关闭">×</button>
            </header>
            <strong>将发往 {confirmSend.preview.domain}</strong>
            <p>当前字段（不含值）：</p>
            <ul>{confirmSend.preview.fields.map((field) => <li key={field.key}>{field.label} · {field.included ? '会发送摘要' : '不会发送'}</li>)}</ul>
            <label className="sa-label">精确确认主机<input value={confirmedHost} onChange={(event) => setConfirmedHost(event.target.value)} placeholder={confirmSend.preview.domain} /></label>
            <div className="sa-actions">
              <button type="submit" className="sa-btn sa-btn-primary">确认发送</button>
              <button type="button" className="sa-btn sa-btn-secondary" onClick={() => setConfirmSend(null)}>取消</button>
            </div>
          </form>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <section className="sa-card">
          <strong>写操作需要在收件箱确认</strong>
          <p>管家只生成草稿，不会直接改账本或日程。</p>
        </section>
      ) : null}

      <form className="sa-card butler-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={busy ? '正在生成…' : '问问今天的状态…'} />
        <button className="sa-btn sa-btn-primary" disabled={busy} type="submit">发送</button>
      </form>
    </div>
  );
}
