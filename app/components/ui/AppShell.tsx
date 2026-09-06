import type { ReactNode } from 'react';

export function AppShell({ theme, children }: { theme?: 'light' | 'dark'; children: ReactNode }) {
  return <main className={`phone-app ${theme === 'dark' ? 'dark' : ''}`}>{children}</main>;
}
