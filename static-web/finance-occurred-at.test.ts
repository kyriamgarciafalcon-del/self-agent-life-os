import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMonthlyReport, transactionsInPeriod } from '../app/finance-query';
import { postFinanceTransaction } from '../app/finance-core';

describe('period reports use occurredAt', () => {
  it('preserves the selected occurrence date when posting a backdated transaction', () => {
    const result = postFinanceTransaction(
      [{ id: 'cash', type: '资金账户', currency: 'CNY', balance: 100 }], [],
      { id: 'late', kind: 'expense', accountId: 'cash', currency: 'CNY', amount: 10,
        occurredAt: '2026-08-31T12:00:00+08:00', createdAt: '2026-09-04T12:00:00+08:00' },
    );
    expect(result.transactions[0]?.occurredAt).toBe('2026-08-31T12:00:00+08:00');
    expect(getMonthlyReport(transactionsInPeriod(result.transactions, '2026-08'), 'CNY').expense).toBe(10);
  });
  it('puts a backdated expense in the month it happened, not the month it was entered', () => {
    const items = [
      {
        id: 'late',
        kind: 'expense',
        amount: 88,
        accountAmount: 88,
        currency: 'CNY',
        createdAt: '2026-09-04T21:00:00+08:00',
        occurredAt: '2026-08-31T12:00:00+08:00',
      },
      {
        id: 'same-day',
        kind: 'expense',
        amount: 12,
        accountAmount: 12,
        currency: 'CNY',
        createdAt: '2026-09-04T09:00:00+08:00',
      },
    ];

    const august = transactionsInPeriod(items, '2026-08');
    const september = transactionsInPeriod(items, '2026-09');

    expect(august.map((item) => item.id)).toEqual(['late']);
    expect(september.map((item) => item.id)).toEqual(['same-day']);
    expect(getMonthlyReport(august, 'CNY')).toEqual({ income: 0, expense: 88, balance: -88 });
    expect(getMonthlyReport(september, 'CNY')).toEqual({ income: 0, expense: 12, balance: -12 });
  });

  it('routes home, finance, data and butler period filters through transactionsInPeriod', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('transactionsInPeriod');
    expect(page).not.toMatch(/createdAt\.startsWith\(MONTH\)/);
    expect(page).not.toMatch(/createdAt\.startsWith\(TODAY\)/);
  });
});
