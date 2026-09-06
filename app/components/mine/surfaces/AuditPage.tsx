import { useState } from 'react';
import {
  AUDIT_OUTCOMES,
  auditOutcomeLabel,
  auditReasonLabel,
  filterAuditLog,
  inboxSourceLabel,
  INBOX_ACTION_LABELS,
  type AuditEntry,
} from '../../../product-logic';

export function AuditPage({ entries }: { entries: AuditEntry[] }) {
  const [outcome, setOutcome] = useState('');
  const [source, setSource] = useState('');
  const visible = filterAuditLog(entries, { outcome, source });
  const sources = Array.from(new Set(entries.map((entry) => entry.source)));

  return (
    <div className="page mine-surface audit-page">
      <header className="sa-page-header">
        <h1>操作历史</h1>
        <p>这里只说明收件箱草稿经历了什么，不提供虚假的二次撤销。密码、密钥和令牌不会写入历史。</p>
      </header>

      <p className="sa-group-header">筛选</p>
      <div className="sa-group">
        <label className="sa-row sa-filter-row">
          <span className="sa-row-text"><strong>结果</strong></span>
          <select aria-label="筛选操作结果" value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            <option value="">全部结果</option>
            {AUDIT_OUTCOMES.map((value) => (
              <option key={value} value={value}>{auditOutcomeLabel(value)}</option>
            ))}
          </select>
        </label>
        <label className="sa-row sa-filter-row">
          <span className="sa-row-text"><strong>来源</strong></span>
          <select aria-label="筛选操作来源" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">全部来源</option>
            {sources.map((value) => (
              <option key={value} value={value}>{inboxSourceLabel(value)}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="sa-group-header">记录</p>
      {visible.length ? visible.map((entry) => (
        <article key={entry.id} className={`sa-card audit-${entry.outcome}`}>
          <header className="memory-card-head">
            <strong>{auditOutcomeLabel(entry.outcome)}</strong>
            <time>{entry.timestamp ? entry.timestamp.replace('T', ' ').slice(0, 16) : '时间未知'}</time>
          </header>
          <h3>{entry.summary}</h3>
          <p>{inboxSourceLabel(entry.source)} · {INBOX_ACTION_LABELS[entry.action]}</p>
          {entry.reason ? <small>原因：{auditReasonLabel(entry.reason)}</small> : null}
          {entry.dataScope ? <small>数据范围：{entry.dataScope}</small> : null}
        </article>
      )) : (
        <div className="sa-group">
          <div className="sa-row">
            <span className="sa-row-text">
              <strong>没有符合条件的操作记录</strong>
              <small>确认、忽略或失败都会出现在这里。</small>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
