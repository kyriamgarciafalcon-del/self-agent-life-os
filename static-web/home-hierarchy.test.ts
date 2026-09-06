import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_SHORTCUTS, homeHasAuthoritativeData, homeHasFinanceData, schedulesOnDate } from '../app/components/daily/home';

describe('home daily logic', () => {
  it('treats missing schedules, accounts and ledger as empty authoritative data', () => {
    expect(homeHasAuthoritativeData({
      schedules: [],
      accounts: [],
      transactions: [],
      healthRecords: [],
      travels: [],
    })).toBe(false);
    expect(homeHasAuthoritativeData({
      schedules: [{ id: 's1' }],
      accounts: [],
      transactions: [],
      healthRecords: [],
      travels: [],
    })).toBe(true);
  });

  it('requires accounts or transactions before showing net worth', () => {
    expect(homeHasFinanceData({ accounts: [], transactions: [] })).toBe(false);
    expect(homeHasFinanceData({ accounts: [], transactions: [{ id: 't1' }] })).toBe(true);
    expect(homeHasFinanceData({ accounts: [{ id: 'a1' }], transactions: [] })).toBe(true);
    expect(homeHasAuthoritativeData({
      schedules: [{ id: 's1' }],
      accounts: [],
      transactions: [],
      healthRecords: [{ id: 'h1' }],
      travels: [],
    })).toBe(true);
    expect(homeHasFinanceData({ accounts: [], transactions: [] })).toBe(false);
  });

  it('keeps only same-day schedules sorted by time', () => {
    expect(schedulesOnDate([
      { id: 'b', date: '2026-09-06', time: '15:00', title: '下午' },
      { id: 'a', date: '2026-09-06', time: '09:00', title: '上午' },
      { id: 'c', date: '2026-09-05', time: '08:00', title: '昨天' },
    ], '2026-09-06').map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('exposes Chinese shortcuts without invented pulse metrics', () => {
    expect(HOME_SHORTCUTS.map((item) => item.title)).toEqual(['记录一件事', '出行', '健康', '管家', '数据', '密码库']);
    expect(HOME_SHORTCUTS.some((item) => item.title === '账本脉搏')).toBe(false);
  });
});

describe('home daily source', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../app/components/daily/HomePage.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/components/daily/daily.css', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');

  it('extracts the home page into daily components and wires callbacks from page.tsx', () => {
    expect(page).toContain("from './components/daily/HomePage'");
    expect(page).toContain('<HomePage');
    expect(page).toContain('onClearDemo={clearLocalData}');
    expect(page).not.toMatch(/\{tab === 'home' && <div className="page home-page">/);
    expect(home).toContain('export function HomePage');
    expect(home).toContain('daily-group');
    expect(home).toContain('今日摘要');
    expect(home).toContain('快捷入口');
    expect(home).toContain('待确认');
    expect(home).toContain('最近入账');
    expect(home).toContain('今天暂无日程');
    expect(home).toContain('hasFinanceData');
  });

  it('keeps demo, permission, empty onboarding, and real pending inbox on home', () => {
    expect(home).toContain('demo-banner');
    expect(home).toContain('capability-card');
    expect(home).toContain('onboarding-card');
    expect(home).toContain('所有内容先整理、确认后再保存。');
    expect(home).toContain('inbox-home');
    expect(home).toContain('待确认');
    expect(home).not.toContain('账本脉搏');
    expect(home).not.toContain('健康一览');
    expect(home).not.toContain('本月收入');
    expect(home).not.toContain('本月支出');
    expect(home).not.toContain('健康评分');
    expect(home).not.toContain('pulse-card');
  });

  it('uses mint large title, 44px taps, grouped rows, and no 375 overflow', () => {
    expect(layout).toContain("./components/daily/daily.css");
    expect(css).toMatch(/\.home-page \.large-title\{[^}]*background:(var\(--mint\)|#e7f6ee|#fff|#FFFFFF|var\(--surface\))/);
    expect(css).toMatch(/\.home-page button\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.home-page\{[^}]*overflow-x:hidden/);
    expect(css).toContain('#F2F2F7');
    expect(css).toContain('#2F6F57');
    expect(css).not.toContain('#007AFF');
  });
});
