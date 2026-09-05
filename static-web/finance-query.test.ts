import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { monthlyFinanceSummary, wealthTotals } from '../app/product-logic';
import {
  getInvestmentValue,
  getMonthlyReport,
  getNetWorth,
  getReceivables,
  getOutstandingReimbursements,
} from '../app/finance-query';

const accounts = [
  { id: 'cash', type: '资金账户', currency: 'CNY', balance: 1000 },
  { id: 'claim', type: '待收回', currency: 'CNY', balance: 80 },
  { id: 'inv', type: '理财账户', currency: 'CNY', balance: 200 },
];
const holdings = [{ accountId: 'inv', quantity: 10, currentPrice: 4 }];
const transactions = [
  { kind: 'income', currency: 'CNY', amount: 9200, accountAmount: 9200, category: '工资' },
  { kind: 'expense', currency: 'CNY', amount: 580, accountAmount: 580 },
  { kind: 'income', currency: 'CNY', amount: 80, accountAmount: 80, category: '报销入账', reimbursementForId: 'e1' },
];

describe('finance query service', () => {
  it('rejects ambiguous mixed-currency totals and allows explicit selection', () => {
    const mixed = [...accounts,
      { id: 'usd-claim', type: '待收回', currency: 'USD', balance: 10 },
      { id: 'usd-inv', type: '理财账户', currency: 'USD', balance: 20 },
    ];
    expect(() => getReceivables(mixed)).toThrow('Mixed currencies');
    expect(getReceivables(mixed, [], [], 'USD')).toBe(10);
    expect(() => getInvestmentValue(mixed, holdings)).toThrow('Mixed currencies');
    expect(getInvestmentValue(mixed, holdings, 'USD')).toEqual({ cash: 20, marketValue: 0, total: 20 });
    expect(getReceivables([], [], [], 'CNY')).toBe(0);
  });

  it('counts outstanding claims across periods, excluding inactive claims and settlements', () => {
    const items = [
      { id: 'old', kind: 'expense', reimbursable: true, amount: 100, currency: 'CNY' },
      { id: 'part', kind: 'settlement', reimbursementForId: 'old', amount: 30, currency: 'CNY' },
      { kind: 'settlement', reimbursementForId: 'old', amount: 20, status: 'reversed' as const },
      { kind: 'settlement', reimbursementForId: 'old', amount: 20, status: 'draft' as const },
      { kind: 'expense', reimbursable: true, amount: 200, currency: 'CNY', status: 'reversed' as const },
      { kind: 'expense', reimbursable: true, amount: 200, currency: 'CNY', status: 'draft' as const },
      { kind: 'expense', reimbursable: true, amount: 10, currency: 'USD' },
    ];
    expect(getOutstandingReimbursements(items, 'CNY')).toBe(70);
    expect(getOutstandingReimbursements(items, 'USD')).toBe(10);
  });

  it('excludes draft, reversed, superseded and reversal entries from reports', () => {
    const expense = { kind: 'expense', currency: 'CNY', amount: 10 };
    expect(getMonthlyReport([
      expense,
      { ...expense, status: 'draft' },
      { ...expense, status: 'reversed' },
      { ...expense, status: 'superseded' },
      { ...expense, reversesId: 'old' },
    ], 'CNY')).toEqual({ income: 0, expense: 10, balance: -10 });
  });
  it('makes getMonthlyReport the only monthly income/expense/balance used by home, finance, AI and export surfaces', () => {
    expect(getMonthlyReport(transactions, 'CNY')).toEqual(monthlyFinanceSummary(transactions, 'CNY'));
    expect(getMonthlyReport(transactions, 'CNY')).toEqual({ income: 9200, expense: 580, balance: 8620 });
  });

  it('makes getNetWorth match wealthTotals including holdings market and receivable balances', () => {
    expect(getNetWorth(accounts, transactions, holdings)).toEqual(wealthTotals(accounts, transactions, holdings));
    expect(getNetWorth(accounts, transactions, holdings)[0]).toMatchObject({
      assets: 1240,
      receivable: 80,
      net: 1320,
    });
  });

  it('exposes receivables and investment value from the same ledger snapshot', () => {
    expect(getReceivables(accounts, transactions, holdings)).toBe(80);
    expect(getInvestmentValue(accounts, holdings)).toEqual({ cash: 200, marketValue: 40, total: 240 });
  });
});

describe('finance query call sites', () => {
  it('keeps account viewing and editing as separate accessible buttons', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const cards = page.split('\n').find((line) => line.includes('className="section-block account-section"'))!;
    expect(cards).not.toContain('role="button"');
    expect(cards).toContain('className="account-open-button"');
    expect(cards).toContain('aria-label={`编辑 ${account.name}`}');
    expect(cards).toContain('aria-label={`查看 ${account.name} 的账单`}');
  });
  it('stops DataPanel and butler from recomputing monthly totals with raw amount reduces', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('getMonthlyReport');
    expect(page).toContain('getNetWorth');
    expect(page).not.toMatch(/filter\(\(item\) => item\.kind === 'income'\)\.reduce\(\(sum, item\) => sum \+ item\.amount/);
    expect(page).not.toMatch(/filter\(\(item\) => item\.kind === 'expense'\)\.reduce\(\(sum, item\) => sum \+ item\.amount/);
  });
});
