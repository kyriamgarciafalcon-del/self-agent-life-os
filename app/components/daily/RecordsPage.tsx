import { type FormEvent } from 'react';
import { inboxAccountsForCurrency, inboxConfidenceLabel, inboxSourceLabel, type InboxItem } from '../../product-logic';
import { inboxConfirmLabel, inboxKindLabel } from './records';

const CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'] as const;
const HEALTH_METRIC_LABELS: Record<string, string> = {
  steps: '步数', heartRate: '心率', stress: '压力', sleep: '睡眠', pai: 'PAI', height: '身高', weight: '体重',
};

function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatInboxTime(value: string) {
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return value;
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日${time ? ` ${time}` : ''}`;
}

type InboxAccount = { id: string; name: string; currency: string };

function InboxEditFields({
  item,
  accounts,
  onPatch,
}: {
  item: InboxItem;
  accounts: InboxAccount[];
  onPatch: (payload: Record<string, unknown>) => void;
}) {
  const payload = item.payload;
  const selectedCurrency = String(payload.currency || '');
  const compatibleAccounts = inboxAccountsForCurrency(accounts, selectedCurrency);
  const selectedAccountId = compatibleAccounts.some((account) => account.id === payload.accountId) ? String(payload.accountId) : '';
  if (item.proposedAction === 'create_expense' || item.proposedAction === 'create_income') {
    return (
      <div className="draft-fields">
        <label>金额<input inputMode="decimal" value={String(payload.amount ?? '')} onChange={(event) => onPatch({ amount: Number(event.target.value) })} /></label>
        <label>商家 / 用途<input value={String(payload.merchant ?? '')} onChange={(event) => onPatch({ merchant: event.target.value })} /></label>
        <label>分类<select value={String(payload.category || '其他')} onChange={(event) => onPatch({ category: event.target.value })}><option>餐饮</option><option>交通</option><option>生活</option><option>医疗</option><option>其他</option><option>收入</option></select></label>
        <label>币种<select aria-label="币种" value={selectedCurrency} onChange={(event) => { const currency = event.target.value; const selected = accounts.find((account) => account.id === payload.accountId); onPatch({ currency, accountId: selected && String(selected.currency || '').toUpperCase() === currency.toUpperCase() ? selected.id : '' }); }}><option value="">请选择币种</option>{CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
        <label>账户<select aria-label="账户" value={selectedAccountId} onChange={(event) => onPatch({ accountId: event.target.value })}><option value="">请选择{selectedCurrency || '同币种'}账户</option>{compatibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>
        {item.proposedAction === 'create_expense' && <label>报销<select value={payload.reimbursable === true ? 'yes' : payload.reimbursable === false ? 'no' : ''} onChange={(event) => onPatch({ reimbursable: event.target.value === '' ? null : event.target.value === 'yes' })}><option value="">请选择</option><option value="no">不报销</option><option value="yes">待收回</option></select></label>}
      </div>
    );
  }
  if (item.proposedAction === 'create_schedule') {
    return (
      <div className="draft-fields">
        <label>日程名称<input value={String(payload.title ?? '')} onChange={(event) => onPatch({ title: event.target.value })} /></label>
        <label>日期<input type="date" value={String(payload.date ?? '')} onChange={(event) => onPatch({ date: event.target.value })} /></label>
        <label>时间<input type="time" value={String(payload.time ?? '')} onChange={(event) => onPatch({ time: event.target.value })} /></label>
      </div>
    );
  }
  if (item.proposedAction === 'create_travel' || item.proposedAction === 'update_travel') {
    return (
      <div className="draft-fields">
        <label>类型<select value={String(payload.travelKind || 'train')} onChange={(event) => onPatch({ travelKind: event.target.value })}><option value="train">火车</option><option value="flight">航班</option></select></label>
        <label>车次 / 航班<input value={String(payload.number ?? '')} onChange={(event) => onPatch({ number: event.target.value })} /></label>
        <label>出发地<input value={String(payload.from ?? '')} onChange={(event) => onPatch({ from: event.target.value })} /></label>
        <label>目的地<input value={String(payload.to ?? '')} onChange={(event) => onPatch({ to: event.target.value })} /></label>
        <label>日期<input type="date" value={String(payload.date ?? '')} onChange={(event) => onPatch({ date: event.target.value })} /></label>
        <label>出发时间<input type="time" value={String(payload.departTime ?? '')} onChange={(event) => onPatch({ departTime: event.target.value })} /></label>
      </div>
    );
  }
  if (item.proposedAction === 'create_health') {
    return (
      <div className="draft-fields">
        <label>指标<select value={String(payload.metric || 'steps')} onChange={(event) => onPatch({ metric: event.target.value })}>{Object.keys(HEALTH_METRIC_LABELS).map((metric) => <option key={metric} value={metric}>{HEALTH_METRIC_LABELS[metric]}</option>)}</select></label>
        <label>数值<input inputMode="decimal" value={String(payload.value ?? '')} onChange={(event) => onPatch({ value: Number(event.target.value) })} /></label>
      </div>
    );
  }
  if (item.proposedAction === 'add_memory' || item.proposedAction === 'update_memory') {
    return (
      <div className="draft-fields">
        <label>标题<input value={String(payload.title ?? '')} onChange={(event) => onPatch({ title: event.target.value })} /></label>
        <label>备注<input value={String(payload.note ?? '')} onChange={(event) => onPatch({ note: event.target.value })} /></label>
      </div>
    );
  }
  return <p className="form-tip">这条建议只能确认或忽略。</p>;
}

export function RecordsPage({
  captureText,
  onCaptureText,
  onOrganize,
  onVoice,
  onImage,
  items,
  accounts,
  editingId,
  canUndo,
  onEdit,
  onPatch,
  onConfirm,
  onIgnore,
  onUndo,
}: {
  captureText: string;
  onCaptureText: (value: string) => void;
  onOrganize: (event: FormEvent<HTMLFormElement>) => void;
  onVoice: () => void;
  onImage: () => void;
  items: InboxItem[];
  accounts: InboxAccount[];
  editingId: string | null;
  canUndo: boolean;
  onEdit: (id: string | null) => void;
  onPatch: (id: string, payload: Record<string, unknown>) => void;
  onConfirm: (id: string) => void;
  onIgnore: (id: string) => void;
  onUndo: () => void;
}) {
  return (
    <div className="page capture-page">
      <p className="daily-kicker">草稿收件箱 · 确认后才写入正式数据</p>
      <form className="capture-box" onSubmit={onOrganize}>
        <textarea aria-label="一句话记录" maxLength={400} value={captureText} onChange={(event) => onCaptureText(event.target.value)} placeholder={'例如：明天 9 点提醒我交水电费\n午饭 36 元，微信支付\n明天 G11 北京南到上海虹桥 9:00\n今天走了 8000 步'} />
        <div className="capture-tools">
          <button type="button" onClick={onVoice}><span aria-hidden="true">🎤</span>语音</button>
          <button type="button" onClick={onImage}><span aria-hidden="true">🖼</span>图片</button>
        </div>
        <div>
          <small>{captureText.length}/400</small>
          <button type="submit">放入收件箱</button>
        </div>
      </form>
      <div className="suggestion-row">
        <button type="button" onClick={() => onCaptureText('午饭 36 元，微信支付')}>午饭 36 元</button>
        <button type="button" onClick={() => onCaptureText('明天 9 点提醒我交水电费')}>明天 9 点提醒</button>
        <button type="button" onClick={() => onCaptureText('明天 G11 北京南到上海虹桥 9:00')}>G11 出行</button>
        <button type="button" onClick={() => onCaptureText('今天走了 8000 步')}>8000 步</button>
      </div>
      {canUndo && <button type="button" className="inbox-undo" onClick={onUndo}>撤销最近一次入账</button>}
      {items.length === 0 ? (
        <div className="daily-empty">
          <p>没有待确认记录</p>
          <p>支付识别、助手建议会出现在这里，确认后才入账或写入日程</p>
        </div>
      ) : (
        <section className="inbox-list">
          {items.map((item) => {
            const kind = inboxKindLabel(item.proposedAction);
            const finance = item.proposedAction === 'create_expense' || item.proposedAction === 'create_income' || item.proposedAction === 'create_transfer';
            return (
              <article className="inbox-card" key={item.id}>
                <div className="inbox-card-body">
                  <div className="inbox-card-meta">
                    <span className="inbox-kind">{kind}</span>
                    <span className="inbox-card-source">{inboxSourceLabel(item.source)} · 置信度 {inboxConfidenceLabel(item.confidence)}</span>
                  </div>
                  <h3>{item.preview}</h3>
                  {finance && <strong className="inbox-card-amount">{String(item.payload.currency || 'CNY')} {money(Math.abs(Number(item.payload.amount || 0)))}</strong>}
                  <p className="inbox-card-preview">{item.preview}</p>
                  <p className="inbox-card-time">{formatInboxTime(item.createdAt)}</p>
                  {editingId === item.id && <InboxEditFields item={item} accounts={accounts} onPatch={(payload) => onPatch(item.id, payload)} />}
                </div>
                <div className="inbox-card-actions">
                  {item.proposedAction !== 'pause_memory' && item.proposedAction !== 'delete_memory' && (
                    <button type="button" className="inbox-edit" onClick={() => onEdit(editingId === item.id ? null : item.id)}>{editingId === item.id ? '收起' : '修改'}</button>
                  )}
                  <div className="inbox-ops">
                    <button type="button" className="ghost" onClick={() => onIgnore(item.id)}>忽略</button>
                    <button type="button" className="confirm-button" onClick={() => onConfirm(item.id)}>{inboxConfirmLabel(item.proposedAction)}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <p className="daily-footnote">草稿 → 确认：财务草稿「确认入账」写入统一账本，其它草稿「确认写入」日程 / 健康等。忽略不改动正式数据。</p>
    </div>
  );
}
