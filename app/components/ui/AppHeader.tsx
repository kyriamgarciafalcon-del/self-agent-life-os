import { IconBack } from './icons';

export function AppHeader({
  title,
  onBack,
  onSettings,
}: {
  title: string;
  onBack: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="app-header">
      <button className="round" type="button" aria-label="返回" onClick={onBack}>
        <IconBack size={22} />
      </button>
      <div>
        <span>SELF AGENT · 本机优先</span>
        <h1>{title}</h1>
      </div>
      <button className="round status-dot" type="button" aria-label="打开设置" onClick={onSettings}>
        <i />
        设
      </button>
    </header>
  );
}
