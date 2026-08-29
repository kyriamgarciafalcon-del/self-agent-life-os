import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildScopedSummary,
  cnyWealthTotal,
  detectLegacyDemoData,
  isBackupPayload,
  localDateKey,
  migrateLegacyReimbursementAccounts,
  parseNaturalCapture,
  assetTotals,
  accountRole,
  applyLedger,
  applyDailyFxRates,
  applyDailyPriceQuotes,
  canApplyLedger,
  defaultCashId,
  removeLedgerTransactionState,
  resolvePaymentAccountId,
  settleReimbursementState,
  upsertByExternalKey,
  wealthTotals,
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

  it('sums every account into one total-assets view without dropping other currencies', () => {
    expect(assetTotals([])).toEqual([]);
    expect(assetTotals([
      { currency: 'CNY', balance: 1200.5 },
      { currency: 'CNY', balance: -80 },
      { currency: 'USD', balance: 99 },
    ])).toEqual([
      { currency: 'CNY', amount: 1120.5 },
      { currency: 'USD', amount: 99 },
    ]);
  });

  it('treats reimbursement as receivable and 欠款 as payable debt', () => {
    expect(accountRole('待收回')).toBe('receivable');
    expect(accountRole('欠款')).toBe('payable');
    expect(accountRole('信用卡')).toBe('liability');
    expect(wealthTotals([
      { type: '资金账户', currency: 'CNY', balance: 1000 },
      { type: '待收回', currency: 'CNY', balance: 36 },
      { type: '欠款', currency: 'CNY', balance: 80 },
      { type: '信用卡', currency: 'CNY', balance: -200 },
    ])).toEqual([{ currency: 'CNY', assets: 1000, receivable: 36, liability: 280, payable: 280, net: 756 }]);
  });

  it('credits a 待收回 claim account when a reimbursable WeChat expense is posted', () => {
    const accounts = [
      { id: 'wechat', type: '资金账户', currency: 'CNY', balance: 200 },
      { id: 'claim', type: '待收回', currency: 'CNY', balance: 0 },
      { id: 'bank', type: '储蓄卡', currency: 'CNY', balance: 10 },
    ];
    const posted = applyLedger(accounts, {
      kind: 'expense',
      accountId: 'wechat',
      accountAmount: 100,
      reimbursable: true,
      reimburseAccountId: 'claim',
    }, 1);
    expect(posted.find((item) => item.id === 'wechat')?.balance).toBe(100);
    expect(posted.find((item) => item.id === 'claim')?.balance).toBe(100);
    expect(posted.find((item) => item.id === 'bank')?.balance).toBe(10);
    expect(wealthTotals(posted, [{ kind: 'expense', currency: 'CNY', accountAmount: 100, reimbursable: true, reimbursed: false, reimburseAccountId: 'claim' }])[0]).toMatchObject({
      assets: 110,
      receivable: 100,
      net: 210,
    });
  });

  it('keeps reimbursement on the payment and deposit accounts instead of a 报销账户', () => {
    const accounts = [
      { id: 'wechat', type: '资金账户', currency: 'CNY', balance: 100 },
      { id: 'bank', type: '储蓄卡', currency: 'CNY', balance: 0 },
    ];
    const posted = applyLedger(accounts, {
      kind: 'expense',
      accountId: 'wechat',
      accountAmount: 36,
      reimbursable: true,
      reimburseAccountId: 'bank',
    }, 1);
    expect(posted.find((item) => item.id === 'wechat')?.balance).toBe(64);
    expect(posted.find((item) => item.id === 'bank')?.balance).toBe(0);
    expect(wealthTotals(posted, [{ kind: 'expense', currency: 'CNY', accountAmount: 36, reimbursable: true, reimbursed: false }])[0]).toMatchObject({
      assets: 64,
      receivable: 36,
      net: 100,
    });
    const repaid = applyLedger(posted, {
      kind: 'income',
      accountId: 'bank',
      accountAmount: 36,
    }, 1);
    expect(repaid.find((item) => item.id === 'wechat')?.balance).toBe(64);
    expect(repaid.find((item) => item.id === 'bank')?.balance).toBe(36);
  });

  it('undoes a reimbursement deposit without losing the pending receivable', () => {
    const paid = [
      { id: 'pay', type: '资金账户', currency: 'CNY', balance: 800 },
      { id: 'deposit', type: '储蓄卡', currency: 'CNY', balance: 100 },
    ];
    const original = { id: 'expense', kind: 'expense' as const, accountId: 'pay', accountAmount: 200, reimbursable: true, reimbursed: false };
    const credit = { id: 'credit', kind: 'income' as const, accountId: 'deposit', accountAmount: 200 };
    const settled = settleReimbursementState(paid, [original], original.id, credit);
    expect(settled.accounts.find((item) => item.id === 'deposit')?.balance).toBe(300);
    expect(settled.transactions.find((item) => item.id === original.id)).toMatchObject({ reimbursed: true, reimbursementTransactionId: 'credit' });
    expect(settled.transactions.find((item) => item.id === credit.id)).toMatchObject({ reimbursementForId: 'expense' });

    const undone = removeLedgerTransactionState(settled.accounts, settled.transactions, credit.id);
    expect(undone.accounts.find((item) => item.id === 'deposit')?.balance).toBe(100);
    expect(undone.transactions.find((item) => item.id === original.id)).toMatchObject({ reimbursed: false });
  });

  it('removes both sides when deleting an already reimbursed expense', () => {
    const paid = [
      { id: 'pay', type: '资金账户', currency: 'CNY', balance: 800 },
      { id: 'deposit', type: '储蓄卡', currency: 'CNY', balance: 300 },
    ];
    const original = { id: 'expense', kind: 'expense' as const, accountId: 'pay', accountAmount: 200, reimbursable: true, reimbursed: true, reimbursementTransactionId: 'credit' };
    const credit = { id: 'credit', kind: 'income' as const, accountId: 'deposit', accountAmount: 200, reimbursementForId: 'expense' };
    const removed = removeLedgerTransactionState(paid, [credit, original], original.id);
    expect(removed.accounts.find((item) => item.id === 'pay')?.balance).toBe(1000);
    expect(removed.accounts.find((item) => item.id === 'deposit')?.balance).toBe(100);
    expect(removed.transactions).toEqual([]);
  });

  it('resolves an auto-ledger hint to the actual user-created payment account', () => {
    const accounts = [
      { id: 'account-random', name: '我的支付宝', type: '资金账户', currency: 'CNY', balance: 500 },
      { id: 'object', name: '笔记本电脑', type: '物品资产', currency: 'CNY', balance: 5000 },
    ];
    expect(resolvePaymentAccountId(accounts, 'alipay', '支付宝')).toBe('account-random');
    expect(resolvePaymentAccountId([accounts[1]], 'alipay', '支付宝')).toBeUndefined();
  });

  it('does not use a physical asset as a default cash account', () => {
    expect(defaultCashId([{ id: 'object', name: '电脑', type: '物品资产', currency: 'CNY', balance: 5000 }], 'CNY')).toBeUndefined();
  });

  it('converts all wealth to CNY only with a dated rate and leaves unknown currency out', () => {
    const accounts = [
      { id: 'cny', type: '资金账户', currency: 'CNY', balance: 100 },
      { id: 'usd', type: '储蓄卡', currency: 'USD', balance: 100 },
    ];
    expect(cnyWealthTotal(accounts, [])).toEqual({ convertedCny: 100, unresolved: [{ currency: 'USD', amount: 100 }] });
    expect(cnyWealthTotal(accounts, [], [{ currency: 'USD', cnyRate: 7.2, asOf: '2026-08-29', source: 'manual', updatedAt: '2026-08-29T12:00:00' }])).toEqual({ convertedCny: 820, unresolved: [] });
    expect(cnyWealthTotal(accounts, [], [{ currency: 'USD', cnyRate: 7.2, asOf: '', source: 'manual', updatedAt: '2026-08-29T12:00:00' }])).toEqual({ convertedCny: 100, unresolved: [{ currency: 'USD', amount: 100 }] });
  });

  it('migrates a legacy reimbursement balance without counting linked expenses twice', () => {
    const migrated = migrateLegacyReimbursementAccounts(
      [
        { id: 'cash', type: '资金账户', currency: 'CNY', balance: 800 },
        { id: 'legacy-reimburse', type: '报销账户', currency: 'CNY', balance: 200 },
      ],
      [{ id: 'expense', kind: 'expense', currency: 'CNY', accountAmount: 200, reimbursable: true, reimbursed: false, reimburseAccountId: 'legacy-reimburse' }],
    );
    expect(migrated.accounts).toEqual([{ id: 'cash', type: '资金账户', currency: 'CNY', balance: 800 }]);
    expect(migrated.transactions[0]).toMatchObject({ reimbursable: true, reimbursed: false, reimburseAccountId: undefined });
    expect(wealthTotals(migrated.accounts, migrated.transactions)).toEqual([{ currency: 'CNY', assets: 800, receivable: 200, liability: 0, payable: 0, net: 1000 }]);
  });

  it('upserts native imports by stable external key', () => {
    const result = upsertByExternalKey(
      [{ id: 'old', externalKey: 'health:2026-08-29:steps', value: 12 }, { id: 'manual', value: 8 }],
      [{ id: 'new', externalKey: 'health:2026-08-29:steps', value: 15 }],
    );
    expect(result).toEqual([{ id: 'new', externalKey: 'health:2026-08-29:steps', value: 15 }, { id: 'manual', value: 8 }]);
  });

  it('upserts a daily CNY rate without touching other currencies', () => {
    const next = applyDailyFxRates(
      [{ currency: 'USD', cnyRate: 7.1, asOf: '2026-08-28', source: 'manual', updatedAt: '2026-08-28T12:00:00' }, { currency: 'EUR', cnyRate: 8.1, asOf: '2026-08-28', source: 'manual', updatedAt: '2026-08-28T12:00:00' }],
      [{ currency: 'USD', cnyRate: 6.72, asOf: '2026-08-29', source: 'daily', updatedAt: '2026-08-29T18:00:00' }],
    );
    expect(next).toEqual([{ currency: 'USD', cnyRate: 6.72, asOf: '2026-08-29', source: 'daily', updatedAt: '2026-08-29T18:00:00' }, { currency: 'EUR', cnyRate: 8.1, asOf: '2026-08-28', source: 'manual', updatedAt: '2026-08-28T12:00:00' }]);
  });

  it('replaces the same daily price point without altering the prior close', () => {
    const next = applyDailyPriceQuotes(
      [{ id: 'etf', currentPrice: 10, updatedAt: '2026-08-28', quoteStatus: 'manual', history: [{ date: '08-28', price: 10 }] }],
      [{ holdingId: 'etf', price: 12.5, asOf: '2026-08-29T18:00:00', source: 'stooq' }],
    );
    expect(next).toEqual([{ id: 'etf', currentPrice: 12.5, updatedAt: '2026-08-29T18:00:00', quoteStatus: 'live', history: [{ date: '08-28', price: 10 }, { date: '08-29', price: 12.5 }] }]);
  });

  it('rejects a debt payment that exceeds the open balance', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', balance: 100 },
      { id: 'debt', type: '欠款', currency: 'CNY', balance: 50 },
    ];
    const payment = { kind: 'transfer' as const, accountId: 'cash', targetAccountId: 'debt', accountAmount: 80 };
    expect(canApplyLedger(accounts, payment)).toBe(false);
  });

  it('repaying 欠款 reduces debt instead of counting it as an asset', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', balance: 200 },
      { id: 'owe', type: '欠款', currency: 'CNY', balance: 80 },
    ];
    const next = applyLedger(accounts, {
      kind: 'transfer',
      accountId: 'cash',
      targetAccountId: 'owe',
      accountAmount: 80,
    }, 1);
    expect(next.find((item) => item.id === 'cash')?.balance).toBe(120);
    expect(next.find((item) => item.id === 'owe')?.balance).toBe(0);
    expect(wealthTotals(next)[0].net).toBe(120);
  });
});
