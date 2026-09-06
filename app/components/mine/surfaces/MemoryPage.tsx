import { normalizeMemory } from '../../../product-logic';

type MemoryItem = {
  id: string;
  kind: '目标' | '偏好' | '观察';
  title: string;
  note: string;
  active: boolean;
  sendAllowed: boolean;
  source: string;
  purpose: string;
  updatedAt: string;
};

export function MemoryPage({
  items,
  onToggle,
  onToggleSend,
  onDelete,
}: {
  items: MemoryItem[];
  onToggle: (id: string) => void;
  onToggleSend: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="page mine-surface memory-page">
      <header className="sa-page-header">
        <h1>记忆管理</h1>
        <p>记忆默认只留在本机。允许发送给 AI 需要单独打开，且记忆摘要权限也要开启。</p>
      </header>

      {items.length ? items.map((item) => {
        const memory = normalizeMemory(item);
        return (
          <article key={item.id} className={`sa-card memory-card ${memory.active ? '' : 'inactive'}`.trim()}>
            <header className="memory-card-head">
              <strong>{memory.title}</strong>
              <small>{memory.kind} · {memory.status}</small>
            </header>
            <p>{memory.note}</p>
            <dl className="memory-meta">
              <div><dt>来源</dt><dd>{memory.source || '本机已有记忆'}</dd></div>
              <div><dt>用途</dt><dd>{memory.purpose}</dd></div>
              <div><dt>发送</dt><dd>{memory.sendAllowed ? '允许进入 AI 摘要' : '仅本机，不发送'}</dd></div>
              <div><dt>更新</dt><dd>{memory.updatedAt || '尚未更新'}</dd></div>
            </dl>
            <div className="sa-actions">
              <button type="button" className="sa-btn sa-btn-secondary" onClick={() => onToggle(item.id)}>
                {memory.active ? '暂停使用' : '重新启用'}
              </button>
              <button type="button" className="sa-btn sa-btn-secondary" onClick={() => onToggleSend(item.id)}>
                {memory.sendAllowed ? '禁止发送给 AI' : '允许发送给 AI'}
              </button>
              <button type="button" className="sa-btn sa-btn-danger" onClick={() => onDelete(item.id)}>删除</button>
            </div>
          </article>
        );
      }) : (
        <div className="sa-group">
          <div className="sa-row">
            <span className="sa-row-text">
              <strong>还没有记忆</strong>
              <small>管家记住的内容会出现在这里，可以暂停、允许发送或删除。</small>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
