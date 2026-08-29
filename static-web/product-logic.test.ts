import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildScopedSummary,
  detectLegacyDemoData,
  isBackupPayload,
  localDateKey,
  otherAssetCurrencies,
  parseNaturalCapture,
  totalAssets,
  weekDates,
} from '../app/product-logic';

describe('local date logic', () => {
  it('derives today and a Monday-first week from the device-local date', () => {
    const saturday = new Date(2026, 7, 29, 6, 30, 0);

    expect(localDateKey(saturday)).toBe('2026-08-29');
    expect(localDateKey(addDays(saturday, 1))).toBe('2026-08-30');
    expect(weekDates('2026-08-29').map((item) => item.value)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });
});

describe('natural capture', () => {
  it('understands the displayed spaced Chinese time example relative to today', () => {
    expect(parseNaturalCapture('明天 9 点提醒我吃药', '2026-08-29')).toEqual({
      kind: 'schedule',
      title: '吃药',
      date: '2026-08-30',
      time: '09:00',
    });
  });

  it('cleans punctuation from the displayed expense example', () => {
    expect(parseNaturalCapture('午饭 36 元，微信支付', '2026-08-29')).toMatchObject({
      kind: 'expense',
      amount: 36,
      merchant: '午饭',
      category: '餐饮',
      source: '微信',
    });
  });
});

describe('truthful product state', () => {
  it('does not leak disabled schedule data into the AI summary', () => {
    const summary = buildScopedSummary({
      today: '2026-08-29',
      month: '2026-08',
      privacy: { schedule: false, finance: false, health: false },
      schedules: [{ date: '2026-08-29', done: false, title: '秘密日程' }],
      transactions: [{ createdAt: '2026-08-29' }],
      healthRecords: [{ id: 'h1' }],
      memories: [{ active: true, title: '每月还债', note: '优先完成' }],
    });

    expect(summary).toContain('日程权限关闭');
    expect(summary).not.toContain('秘密日程');
    expect(summary).toContain('每月还债');
  });

  it('recognizes the legacy bundled sample instead of presenting it as real data', () => {
    expect(detectLegacyDemoData({ schedules: [{ id: 's1' }], accounts: [{ id: 'wechat' }] })).toBe(true);
    expect(detectLegacyDemoData({ schedules: [], accounts: [] })).toBe(false);
  });

  it('accepts a structured backup and rejects malformed data before replacement', () => {
    expect(isBackupPayload({ schedules: [], accounts: [], transactions: [] })).toBe(true);
    expect(isBackupPayload({ schedules: 'not-an-array', accounts: [], transactions: [] })).toBe(false);
    expect(isBackupPayload(null)).toBe(false);
  });

  it('sums real account balances as total assets and stays zero when empty', () => {
    expect(totalAssets([], 'CNY')).toBe(0);
    expect(totalAssets([
      { currency: 'CNY', balance: 1200.5 },
      { currency: 'CNY', balance: -80 },
      { currency: 'USD', balance: 99 },
    ], 'CNY')).toBe(1120.5);
    expect(otherAssetCurrencies([
      { currency: 'CNY', balance: 1 },
      { currency: 'USD', balance: 2 },
      { currency: 'USD', balance: 3 },
    ], 'CNY')).toEqual(['USD']);
  });
});
