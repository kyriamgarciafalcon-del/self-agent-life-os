import type { ReactNode } from 'react';

export function LargeTitle({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <section className="large-title">
      {kicker ? <span>{kicker}</span> : null}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function GroupedList({ children }: { children: ReactNode }) {
  return <div className="grouped-list">{children}</div>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  return <b className="status-pill">{children}</b>;
}
