type PrivacySettings = { health: boolean; finance: boolean; schedule: boolean; memory: boolean };

const ROWS: { key: keyof PrivacySettings; mark: string; tone: 'mint' | 'teal' | 'orange' | 'ink'; title: string; note: string }[] = [
  { key: 'health', mark: '健', tone: 'mint', title: '健康摘要', note: '身高、体重、心率、压力、睡眠和 PAI' },
  { key: 'finance', mark: '财', tone: 'teal', title: '财务摘要', note: '收入、支出、分类和未来扣款' },
  { key: 'schedule', mark: '日', tone: 'orange', title: '日程与行动', note: '用于排序、提醒与完成情况' },
  { key: 'memory', mark: '忆', tone: 'ink', title: '记忆摘要', note: '仅发送已单独允许的记忆，默认关闭' },
];

export function PrivacyPage({
  settings,
  onToggle,
}: {
  settings: PrivacySettings;
  onToggle: (key: keyof PrivacySettings) => void;
}) {
  return (
    <div className="page mine-surface privacy-page">
      <header className="sa-page-header">
        <h1>隐私与权限</h1>
        <p>每类摘要可以单独关闭；密码权限永久不开放。当前开关会真实影响本机管家可使用的摘要范围。</p>
      </header>

      <p className="sa-group-header">摘要权限</p>
      <div className="sa-group">
        {ROWS.map((row) => (
          <div className="sa-row" key={row.key}>
            <span className={`sa-row-icon ${row.tone}`} aria-hidden="true">{row.mark}</span>
            <span className="sa-row-text">
              <strong>{row.title}</strong>
              <small>{row.note}</small>
            </span>
            <button
              type="button"
              className={settings[row.key] ? 'sa-switch on' : 'sa-switch'}
              onClick={() => onToggle(row.key)}
              aria-label={`${row.title}权限`}
              aria-pressed={settings[row.key]}
            >
              <i />
            </button>
          </div>
        ))}
        <div className="sa-row">
          <span className="sa-row-icon gray" aria-hidden="true">钥</span>
          <span className="sa-row-text">
            <strong>密码与恢复码</strong>
            <small>密码、验证码、私钥、助记词永久禁止</small>
          </span>
          <button type="button" className="sa-switch" disabled aria-label="密码权限永久关闭">
            <i />
          </button>
        </div>
      </div>
      <p className="sa-page-footer">本机优先。关闭后管家回答时不会使用该类摘要，不只是界面状态。</p>
    </div>
  );
}
