import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  formatNavBadge,
  PRIMARY_NAV,
  primaryNavActiveId,
  SHELL_TOKENS,
} from '../app/components/ui/nav';

describe('shell nav source', () => {
  it('exposes exactly five primary tabs: home schedule capture finance profile', () => {
    expect(PRIMARY_NAV.map((item) => [item.id, item.label])).toEqual([
      ['home', '首页'],
      ['schedule', '日程'],
      ['capture', '记录'],
      ['finance', '财务'],
      ['profile', '我的'],
    ]);
    expect(PRIMARY_NAV).toHaveLength(5);
  });

  it('keeps life as a secondary surface under 我的, not a root tab', () => {
    expect(PRIMARY_NAV.map((item) => item.id)).not.toContain('life');
    expect(PRIMARY_NAV.map((item) => item.label)).not.toContain('生活');
    expect(primaryNavActiveId('life')).toBe('profile');
    expect(primaryNavActiveId('health')).toBe('profile');
    expect(primaryNavActiveId('schedule')).toBe('schedule');
    expect(primaryNavActiveId('home')).toBe('home');
  });

  it('formats the capture badge and uses mint instead of iOS blue', () => {
    expect(formatNavBadge(0)).toBeNull();
    expect(formatNavBadge(3)).toBe('3');
    expect(formatNavBadge(12)).toBe('9+');
    expect(SHELL_TOKENS.pageBg).toBe('#F2F2F7');
    expect(SHELL_TOKENS.surface).toBe('#FFFFFF');
    expect(SHELL_TOKENS.accent).toBe('#2F6F57');
    expect(SHELL_TOKENS.accent.toUpperCase()).not.toBe('#007AFF');
    expect(SHELL_TOKENS.tapMin).toBe(44);
  });
});

describe('shell nav wiring', () => {
  it('keeps BottomNav, AppHeader and icons out of page.tsx', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const nav = readFileSync(new URL('../app/components/ui/nav.ts', import.meta.url), 'utf8');
    const bottom = readFileSync(new URL('../app/components/ui/BottomNav.tsx', import.meta.url), 'utf8');
    const header = readFileSync(new URL('../app/components/ui/AppHeader.tsx', import.meta.url), 'utf8');
    const icons = readFileSync(new URL('../app/components/ui/icons.tsx', import.meta.url), 'utf8');
    const shell = readFileSync(new URL('../app/components/ui/shell.css', import.meta.url), 'utf8');

    expect(page).toContain("from './components/ui/BottomNav'");
    expect(page).toContain("from './components/ui/AppHeader'");
    expect(page).toContain("from './components/ui/AppShell'");
    expect(page).toContain('<BottomNav');
    expect(page).toContain('<AppHeader');
    expect(page).toContain("navigate('life')");
    expect(page).not.toContain("label: '今天'");
    expect(page).not.toContain("label: '收件箱'");
    expect(page).not.toContain("label: '生活'");
    expect(page).toContain("self-agent:back");

    expect(nav).toContain("label: '首页'");
    expect(bottom).toContain("from './icons'");
    expect(bottom).toContain('PRIMARY_NAV');
    expect(bottom).toContain('formatNavBadge');
    expect(header).toContain('aria-label="返回"');
    expect(icons).toContain('<svg');
    expect(icons).toContain('viewBox="0 0 24 24"');
    expect(shell).toContain('--accent:#2F6F57');
    expect(shell).not.toContain('#007AFF');
    expect(shell).toMatch(/\.bottom-nav button\{[^}]*min-height:44px/);
  });
});
