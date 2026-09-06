import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function homeSlice(page: string) {
  const start = page.indexOf("{tab === 'home' &&");
  const end = page.indexOf("{tab === 'schedule' &&");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return page.slice(start, end);
}

describe('shipping home hierarchy', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const home = homeSlice(page);

  it('reuses LargeTitle for date, greeting, and confirm-first copy instead of a green hero card', () => {
    expect(home).toContain('<LargeTitle kicker={TODAY_LABEL} title={GREETING}');
    expect(home).toContain('所有内容先整理、确认后再保存。');
    expect(home).not.toContain('hero-card');
    expect(home).not.toMatch(/linear-gradient/);
  });

  it('keeps demo, permission, empty onboarding, and pending inbox on home', () => {
    expect(home).toContain('demo-banner');
    expect(home).toContain('capability-card');
    expect(home).toContain('onboarding-card');
    expect(home).toContain('inbox-home');
    expect(home).toContain('待确认');
  });

  it('groups next schedule and today spend / net worth as 今日概况 with existing helpers', () => {
    expect(home).toContain('今日概况');
    expect(home).toContain('nextSchedule');
    expect(home).toContain('todaySpend');
    expect(home).toContain('totalBalanceLabel');
    expect(home).not.toContain('本月收入');
    expect(home).not.toContain('本月支出');
    expect(home).not.toContain('本月结余');
  });

  it('keeps capture, tools, and recent ledger with concise Chinese group titles', () => {
    expect(home).toContain('快速记录');
    expect(home).toContain('生活工具');
    expect(home).toContain('最近入账');
    expect(home).toContain('capture-callout');
    expect(home).toContain('feature-grid');
    expect(home).toContain('TransactionList');
    expect(home).not.toContain('QUICK CAPTURE');
    expect(home).not.toContain('FEATURES');
    expect(home).not.toContain('RECENT');
  });

  it('does not ship attachment mock cards or invented health scores on home', () => {
    expect(home).not.toContain('账本脉搏');
    expect(home).not.toContain('健康一览');
    expect(home).not.toContain('pulse-card');
    expect(home).not.toContain('健康评分');
  });

  it('uses mint/near-white home title and 44px home actions without 375 overflow', () => {
    expect(css).toMatch(/\.home-page \.large-title\{[^}]*background:(var\(--mint\)|#e7f6ee|#fff|#FFFFFF|var\(--surface\))/);
    expect(css).toMatch(/\.home-page button\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.home-page\{[^}]*overflow-x:hidden/);
  });
});
