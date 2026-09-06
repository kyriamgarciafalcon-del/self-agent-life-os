import type { FormEvent, ReactNode } from 'react';

export function MineHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sa-page-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <>
      {title ? <p className="sa-group-header">{title}</p> : null}
      <div className="sa-group">{children}</div>
    </>
  );
}

export function SettingsRow({
  mark,
  tone = 'mint',
  title,
  subtitle,
  onClick,
}: {
  mark: string;
  tone?: 'mint' | 'red' | 'orange' | 'gray' | 'teal' | 'ink';
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="sa-row" onClick={onClick}>
      <span className={`sa-row-icon ${tone}`} aria-hidden="true">{mark}</span>
      <span className="sa-row-text">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      <span className="sa-chevron" aria-hidden="true">›</span>
    </button>
  );
}

export function MineCard({ children }: { children: ReactNode }) {
  return <section className="sa-card">{children}</section>;
}

export function MineSheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sa-sheet-backdrop" aria-label="关闭" onClick={onClose} />
      <form className="sheet" onSubmit={(event: FormEvent) => event.preventDefault()}>
        <div className="handle" />
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div>{children}</div>
        {footer}
      </form>
    </div>
  );
}
