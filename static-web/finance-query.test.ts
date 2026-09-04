import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { monthlyFinanceSummary, wealthTotals } from '../app/product-logic';
import {
  getInvestmentValue,
  getMonthlyReport,
  getNetWorth,
  getReceivables,
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
  it('stops DataPanel and butler from recomputing monthly totals with raw amount reduces', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('getMonthlyReport');
    expect(page).toContain('getNetWorth');
    expect(page).not.toMatch(/filter\(\(item\) => item\.kind === 'income'\)\.reduce\(\(sum, item\) => sum \+ item\.amount/);
    expect(page).not.toMatch(/filter\(\(item\) => item\.kind === 'expense'\)\.reduce\(\(sum, item\) => sum \+ item\.amount/);
  });
});
