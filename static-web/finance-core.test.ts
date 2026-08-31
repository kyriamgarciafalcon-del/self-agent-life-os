import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  applyDailyPriceQuotes,
  applyLedger,
  buildReimbursementSettlement,
  canDeleteAccount,
  composeTransactionPostings,
  derivedAccountBalance,
  FINANCE_TABS,
  financeTransactionFields,
  investmentAccountSnapshot,
  isMonthlyIncome,
  migrateInvestmentCash,
  migrateSubscriptionAccounts,
  migrateToPostingLedger,
  monthlyIncomeTotal,
  normalizeFinanceRecords,
  postBalanceAdjustment,
  postFinanceTransaction,
  refreshHoldingsValuation,
  removeLedgerTransactionState,
  resolveTransferAmounts,
  reimbursementOutstandingAmount,
  runFinanceInvariantSequence,
  settleReimbursementState,
  wealthTotals,
} from '../app/product-logic';

describe('reimbursement persistence association', () => {
  it('keeps one receivable through save-normalize-settle-delete without duplicating wealth', () => {
    const seedAccounts = [
      { id: 'wechat', name: '微信', type: '资金账户', currency: 'CNY', balance: 200 },
      { id: 'claim', name: '待收回', type: '待收回', currency: 'CNY', balance: 0 },
      { id: 'bank', name: '银行卡', type: '储蓄卡', currency: 'CNY', balance: 10 },
    ];
    const expense = {
      id: 'e1',
      kind: 'expense' as const,
      accountId: 'wechat',
      accountAmount: 100,
      amount: 100,
      currency: 'CNY',
      reimbursable: true,
      reimburseAccountId: 'claim',
      reimbursed: false,
    };

    const postedAccounts = applyLedger(seedAccounts, expense, 1);
    const persisted = JSON.parse(JSON.stringify({ accounts: postedAccounts, transactions: [expense] }));
    const normalized = normalizeFinanceRecords(persisted.accounts, persisted.transactions);

    expect(normalized.transactions[0]?.reimburseAccountId).toBe('claim');
    expect(wealthTotals(normalized.accounts, normalized.transactions)[0]).toMatchObject({
      assets: 110,
      receivable: 100,
      net: 210,
    });

    const credit = {
      id: 'c1',
      kind: 'income' as const,
      accountId: 'bank',
      accountAmount: 100,
    };
    const settled = settleReimbursementState(normalized.accounts, normalized.transactions, 'e1', credit);
    expect(wealthTotals(settled.accounts, settled.transactions)[0]).toMatchObject({
      assets: 210,
      receivable: 0,
      net: 210,
    });

    const deleted = removeLedgerTransactionState(settled.accounts, settled.transactions, 'e1');
    expect(deleted.transactions).toEqual([]);
    expect(wealthTotals(deleted.accounts, deleted.transactions)[0]).toMatchObject({
      assets: 210,
      receivable: 0,
      net: 210,
    });
  });
});

describe('transaction posting ledger', () => {
  it('migrates stored balances into opening balances plus postings and derives the same cash', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', balance: 900 },
      { id: 'card', type: '信用卡', currency: 'CNY', balance: 200 },
    ];
    const transactions = [
      { id: 't1', kind: 'expense' as const, accountId: 'cash', amount: 100, accountAmount: 100, currency: 'CNY' },
      { id: 't2', kind: 'expense' as const, accountId: 'card', amount: 50, accountAmount: 50, currency: 'CNY' },
    ];
    const migrated = migrateToPostingLedger(accounts, transactions);
    expect(migrated.accounts.find((item) => item.id === 'cash')?.openingBalance).toBe(1000);
    expect(migrated.accounts.find((item) => item.id === 'card')?.openingBalance).toBe(150);
    expect(migrated.transactions[0]?.postings).toEqual([{ accountId: 'cash', amount: -100, currency: 'CNY' }]);
    expect(migrated.transactions[1]?.postings).toEqual([{ accountId: 'card', amount: 50, currency: 'CNY' }]);
    expect(derivedAccountBalance(migrated.accounts.find((item) => item.id === 'cash')!, migrated.transactions)).toBe(900);
    expect(derivedAccountBalance(migrated.accounts.find((item) => item.id === 'card')!, migrated.transactions)).toBe(200);
    expect(migrated.accounts.find((item) => item.id === 'cash')?.balance).toBe(900);
  });

  it('records a balance change as an adjustment transaction instead of editing opening cash', () => {
    const migrated = migrateToPostingLedger([{ id: 'cash', type: '资金账户', currency: 'CNY', balance: 100 }], []);
    const next = postBalanceAdjustment(migrated.accounts, migrated.transactions, {
      id: 'adj1',
      accountId: 'cash',
      targetBalance: 150,
      createdAt: '2026-08-31T10:00:00',
    });
    expect(next.accounts.find((item) => item.id === 'cash')?.openingBalance).toBe(100);
    expect(next.transactions[0]).toMatchObject({ kind: 'adjustment', accountId: 'cash', accountAmount: 50 });
    expect(derivedAccountBalance(next.accounts[0], next.transactions)).toBe(150);
  });
});

describe('investment cash versus market value', () => {
  it('keeps investment cash separate from holdings market value so total is cash plus market', () => {
    const account = { id: 'inv', type: '理财账户', currency: 'CNY', openingBalance: 500, balance: 500 };
    const holdings = [
      { id: 'h1', accountId: 'inv', quantity: 10, currentPrice: 4, averageCost: 3, currency: 'CNY', updatedAt: '2026-08-30', quoteStatus: 'manual', history: [] as { date: string; price: number }[] },
    ];
    expect(investmentAccountSnapshot(account, holdings)).toEqual({ cash: 500, marketValue: 40, total: 540 });
  });

  it('treats a legacy 理财账户 whose stored balance equals market value as cash 0', () => {
    const migrated = migrateInvestmentCash(
      [{ id: 'inv', type: '理财账户', currency: 'CNY', balance: 40 }],
      [{ id: 'h1', accountId: 'inv', quantity: 10, currentPrice: 4 }],
    );
    expect(migrated[0]).toMatchObject({ openingBalance: 0, balance: 0 });
    expect(investmentAccountSnapshot(migrated[0], [{ id: 'h1', accountId: 'inv', quantity: 10, currentPrice: 4 }])).toEqual({
      cash: 0,
      marketValue: 40,
      total: 40,
    });
  });

  it('refreshes quotes as valuation only without touching investment cash', () => {
    const accounts = [{ id: 'inv', type: '理财账户', currency: 'CNY', openingBalance: 80, balance: 80 }];
    const holdings = [
      { id: 'h1', accountId: 'inv', quantity: 10, currentPrice: 4, updatedAt: '2026-08-28', quoteStatus: 'manual' as const, history: [{ date: '08-28', price: 4 }] },
    ];
    const next = refreshHoldingsValuation(accounts, holdings, [{ holdingId: 'h1', price: 5, asOf: '2026-08-29T18:00:00', source: 'stooq' }]);
    expect(next.accounts[0]?.balance).toBe(80);
    expect(next.holdings[0]?.currentPrice).toBe(5);
    expect(investmentAccountSnapshot(next.accounts[0]!, next.holdings).total).toBe(130);
  });
});

describe('expense and repayment ruleset', () => {
  const accounts = [
    { id: 'cash', type: '资金账户', currency: 'CNY', balance: 200, openingBalance: 200 },
    { id: 'card', type: '信用卡', currency: 'CNY', balance: 80, openingBalance: 80 },
    { id: 'owe', type: '欠款', currency: 'CNY', balance: 50, openingBalance: 50 },
    { id: 'claim', type: '待收回', currency: 'CNY', balance: 0, openingBalance: 0 },
  ];

  it('decreases an asset and increases credit or payable for the same expense ruleset', () => {
    expect(composeTransactionPostings(accounts, { kind: 'expense', accountId: 'cash', amount: 30, currency: 'CNY' })).toEqual([
      { accountId: 'cash', amount: -30, currency: 'CNY' },
    ]);
    expect(composeTransactionPostings(accounts, { kind: 'expense', accountId: 'card', amount: 30, currency: 'CNY' })).toEqual([
      { accountId: 'card', amount: 30, currency: 'CNY' },
    ]);
  });

  it('credits 待收回 immediately on a reimbursable expense', () => {
    expect(composeTransactionPostings(accounts, {
      kind: 'expense',
      accountId: 'cash',
      amount: 40,
      currency: 'CNY',
      reimbursable: true,
      reimburseAccountId: 'claim',
    })).toEqual([
      { accountId: 'cash', amount: -40, currency: 'CNY' },
      { accountId: 'claim', amount: 40, currency: 'CNY' },
    ]);
  });

  it('decreases cash and debt on repayment and is used by both posting paths', () => {
    const repayment = { kind: 'transfer' as const, accountId: 'cash', targetAccountId: 'owe', amount: 20, currency: 'CNY' };
    expect(composeTransactionPostings(accounts, repayment)).toEqual([
      { accountId: 'cash', amount: -20, currency: 'CNY' },
      { accountId: 'owe', amount: -20, currency: 'CNY' },
    ]);
    const manual = postFinanceTransaction(accounts, [], { id: 'm1', ...repayment, source: 'manual' });
    const notice = postFinanceTransaction(accounts, [], { id: 'n1', ...repayment, source: 'notification' });
    expect(manual.accounts.find((item) => item.id === 'cash')?.balance).toBe(180);
    expect(manual.accounts.find((item) => item.id === 'owe')?.balance).toBe(30);
    expect(notice.accounts.find((item) => item.id === 'owe')?.balance).toBe(30);
    expect(manual.transactions[0]?.postings).toEqual(notice.transactions[0]?.postings);
  });
});

describe('explicit amounts and currencies', () => {
  it('forces rate 1 and matching amounts for same-currency transfers', () => {
    expect(resolveTransferAmounts({ sourceCurrency: 'CNY', targetCurrency: 'CNY', amount: 80, rate: 7.2 })).toEqual({
      sourceAmount: 80,
      targetAmount: 80,
      rate: 1,
    });
  });

  it('posts the explicit target amount for a cross-currency reimbursement', () => {
    const accounts = [
      { id: 'usd', type: '资金账户', currency: 'USD', balance: 20, openingBalance: 20 },
      { id: 'claim', type: '待收回', currency: 'CNY', balance: 0, openingBalance: 0 },
    ];
    const posted = postFinanceTransaction(accounts, [], {
      id: 'fx1',
      kind: 'expense',
      accountId: 'usd',
      amount: 10,
      currency: 'USD',
      accountAmount: 10,
      targetAmount: 72,
      targetCurrency: 'CNY',
      reimbursable: true,
      reimburseAccountId: 'claim',
      source: 'manual',
    });
    expect(posted.transactions[0]?.postings).toEqual([
      { accountId: 'usd', amount: -10, currency: 'USD' },
      { accountId: 'claim', amount: 72, currency: 'CNY' },
    ]);
    expect(posted.accounts.find((item) => item.id === 'usd')?.balance).toBe(10);
    expect(posted.accounts.find((item) => item.id === 'claim')?.balance).toBe(72);
  });
});

describe('reimbursement settlement cashflow', () => {
  it('uses the explicit claim/account amount instead of the foreign display amount', () => {
    const original = { id: 'fx', amount: 10, accountAmount: 72, targetAmount: 72, currency: 'USD', targetCurrency: 'CNY' };
    expect(reimbursementOutstandingAmount(original)).toEqual({ amount: 72, currency: 'CNY' });
  });

  it('settles reimbursement as cashflow not monthly income', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', balance: 100, openingBalance: 100 },
      { id: 'claim', type: '待收回', currency: 'CNY', balance: 40, openingBalance: 40 },
    ];
    const original = {
      id: 'e1',
      kind: 'expense' as const,
      accountId: 'cash',
      accountAmount: 40,
      amount: 40,
      currency: 'CNY',
      reimbursable: true,
      reimburseAccountId: 'claim',
      reimbursed: false,
    };
    const settlement = buildReimbursementSettlement(original, { id: 's1', counterpartId: 'cash', amount: 40, currency: 'CNY' });
    expect(settlement.kind).toBe('settlement');
    expect(isMonthlyIncome(settlement)).toBe(false);
    const settled = settleReimbursementState(accounts, [original], 'e1', settlement);
    expect(monthlyIncomeTotal(settled.transactions, 'CNY')).toBe(0);
    expect(settled.accounts.find((item) => item.id === 'claim')?.balance).toBe(0);
    expect(settled.accounts.find((item) => item.id === 'cash')?.balance).toBe(140);
  });
});

describe('subscription migration and account deletion', () => {
  it('migrates 订阅账户 off the account-type list without dropping a leftover cash balance', () => {
    expect(ACCOUNT_TYPES).not.toContain('订阅账户');
    const migrated = migrateSubscriptionAccounts([{ id: 'sub', type: '订阅账户', currency: 'CNY', balance: 12 }]);
    expect(migrated[0]).toMatchObject({ type: '资金账户', balance: 12 });
  });

  it('blocks account deletion when postings, holdings, rules or a nonzero balance remain', () => {
    const accounts = [
      { id: 'cash', type: '资金账户', currency: 'CNY', openingBalance: 0, balance: 0 },
      { id: 'busy', type: '储蓄卡', currency: 'CNY', openingBalance: 8, balance: 8 },
    ];
    const transactions = [{ id: 't1', postings: [{ accountId: 'busy', amount: 8, currency: 'CNY' }] }];
    expect(canDeleteAccount({ accountId: 'cash', accounts, transactions, holdings: [], rules: [] }).ok).toBe(true);
    expect(canDeleteAccount({ accountId: 'busy', accounts, transactions, holdings: [], rules: [] }).ok).toBe(false);
    expect(canDeleteAccount({
      accountId: 'cash',
      accounts,
      transactions: [],
      holdings: [{ id: 'h1', accountId: 'cash' }],
      rules: [],
    }).ok).toBe(false);
    expect(canDeleteAccount({
      accountId: 'cash',
      accounts,
      transactions: [],
      holdings: [],
      rules: [{ id: 'r1', accountId: 'cash' }],
    }).ok).toBe(false);
  });
});

describe('deterministic finance invariants', () => {
  it('holds derived balances and unduplicated wealth for a seeded random sequence', () => {
    const report = runFinanceInvariantSequence(20260831, 48);
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });
});

describe('finance UI structure', () => {
  it('exposes accessible tabs and one progressive add entry', () => {
    expect(FINANCE_TABS).toEqual(['总览', '账户', '流水', '投资', '周期账单']);
    expect(financeTransactionFields('expense', { reimbursable: false })).toEqual([
      'kind', 'amount', 'currency', 'merchant', 'category', 'accountId', 'reimbursable',
    ]);
    expect(financeTransactionFields('expense', { reimbursable: true })).toContain('reimburseAccountId');
    expect(financeTransactionFields('transfer', { sameCurrency: true })).toEqual([
      'kind', 'amount', 'currency', 'merchant', 'accountId', 'targetAccountId',
    ]);
    expect(financeTransactionFields('transfer', { sameCurrency: false })).toEqual([
      'kind', 'amount', 'currency', 'merchant', 'accountId', 'targetAccountId', 'rate', 'targetAmount',
    ]);
  });

  it('keeps finance stylesheet type at or above 12px', () => {
    const css = readFileSync(new URL('../app/finance.css', import.meta.url), 'utf8');
    const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it('restructures the finance page into accessible tabs with one add entry and a settlement sheet', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toMatch(/role="tablist"/);
    for (const tab of FINANCE_TABS) expect(page).toContain(tab);
    expect(page).toMatch(/aria-label=\{tab === 'schedule' \? '新建日程' : '新建流水'\}/);
    expect(page).toContain('settle-reimbursement');
    expect(page).toContain('normalizeFinanceRecords');
    expect(page).toContain('canDeleteAccount');
    expect(page).toContain('postBalanceAdjustment');
    expect(page).toContain('investmentAccountSnapshot');
    expect(page).toContain('financeTransactionFields');
    expect(page).not.toContain("'订阅账户'");
    expect(page).not.toMatch(/if \(dest && accountRole\(dest\.type\) === 'receivable'\) return undefined/);
    expect(page).not.toContain('syncInvestmentBalances');
  });
});

describe('wealth with separated investment cash', () => {
  it('counts 理财账户 cash plus holdings market without double-counting', () => {
    expect(wealthTotals(
      [{ id: 'inv', type: '理财账户', currency: 'CNY', balance: 100 }],
      [],
      [{ accountId: 'inv', quantity: 10, currentPrice: 4 }],
    )[0]).toMatchObject({ assets: 140, net: 140 });
  });
});
