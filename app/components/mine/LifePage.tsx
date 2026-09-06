import { SettingsGroup, SettingsRow } from './primitives';

export function LifePage({ onNavigate }: { onNavigate: (tab: 'schedule' | 'health' | 'travel' | 'memory' | 'butler') => void }) {
  return (
    <div className="page life-page">
      <header className="sa-page-header">
        <h1>生活</h1>
        <h2>健康、出行和记忆</h2>
      </header>
      <SettingsGroup title="功能">
        <SettingsRow mark="日" tone="mint" title="日程" subtitle="今天的安排" onClick={() => onNavigate('schedule')} />
        <SettingsRow mark="健" tone="red" title="健康" subtitle="身高体重心率" onClick={() => onNavigate('health')} />
        <SettingsRow mark="行" tone="teal" title="出行" subtitle="火车与航班" onClick={() => onNavigate('travel')} />
        <SettingsRow mark="忆" tone="ink" title="记忆" subtitle="管家记住什么" onClick={() => onNavigate('memory')} />
        <SettingsRow mark="管" tone="orange" title="管家" subtitle="本机摘要问答" onClick={() => onNavigate('butler')} />
      </SettingsGroup>
      <p className="sa-page-footer">完整记录进入二级页面，首页只保留摘要。</p>
    </div>
  );
}
