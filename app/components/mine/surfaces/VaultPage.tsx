import { HowToNative } from '../HowToNative';

type VaultItem = { id?: string; title: string; usernameHint: string; note?: string };

function revealSecret(id: string, onReveal?: (id: string) => void) {
  if (onReveal) {
    onReveal(id);
    return;
  }
  (window as Window & { SelfAgentNative?: { revealPassword?: (id: string) => void } }).SelfAgentNative?.revealPassword?.(id);
}

export function VaultPage({
  items,
  nativeOn,
  onReveal,
}: {
  items: VaultItem[];
  nativeOn: boolean;
  onReveal?: (id: string) => void;
}) {
  return (
    <div className="page mine-surface vault-page">
      <header className="sa-page-header">
        <h1>密码库</h1>
        <p>{nativeOn ? 'Keystore 密码库已连接。点「查看」后需指纹或锁屏验证。' : '请在 Android App 中查看密码。密码明文只在本机 Keystore。'}</p>
      </header>

      <section className="sa-card">
        <strong>{nativeOn ? '指纹或锁屏后可查看' : '安全密码库入口'}</strong>
        <p>密码明文只在本机 Keystore。不会写入网页存储，也不会进 AI。查看必须走系统验证。</p>
      </section>

      <p className="sa-group-header">账号目录</p>
      <div className="sa-group">
        {items.length ? items.map((item) => (
          <div className="sa-row" key={item.id || item.title}>
            <span className="sa-row-icon gray" aria-hidden="true">{item.title.slice(0, 1)}</span>
            <span className="sa-row-text">
              <strong>{item.title}</strong>
              <small>{item.usernameHint}{item.note ? ` · ${item.note}` : ''}</small>
            </span>
            {nativeOn ? (
              <button type="button" className="sa-btn sa-btn-secondary vault-reveal" onClick={() => revealSecret(item.id || item.title, onReveal)}>查看</button>
            ) : null}
          </div>
        )) : (
          <div className="sa-row">
            <span className="sa-row-text">
              <strong>还没有账号元数据</strong>
              <small>这里只显示账号名和提示，不会出现密码明文。</small>
            </span>
          </div>
        )}
      </div>

      {nativeOn ? (
        <div className="sa-actions mine-surface-actions">
          <button
            type="button"
            className="sa-btn sa-btn-secondary"
            onClick={() => (window as Window & { SelfAgentNative?: { openAutofillSettings?: () => void } }).SelfAgentNative?.openAutofillSettings?.()}
          >
            打开系统自动填充设置
          </button>
        </div>
      ) : null}

      <HowToNative />

      <section className="sa-card">
        <strong>密码不会进入 AI</strong>
        <p>导出和管家问答只有账号名。查看明文必须通过指纹或锁屏验证，并只显示在系统弹窗里。</p>
      </section>
    </div>
  );
}
