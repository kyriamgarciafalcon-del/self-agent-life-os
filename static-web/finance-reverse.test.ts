import { describe, expect, it } from 'vitest';
import { derivedAccountBalance, monthlyFinanceSummary, postFinanceTransaction, reverseTransaction } from '../app/finance-core';

type ReverseFields = { status?: string; reversesId?: string; reversedBy?: string };

describe('reverse instead of physical delete', () => {
  it('keeps a confirmed expense and restores cash via an opposite posting', () => {
    const seed = [{ id: 'cash', type: '资金账户', currency: 'CNY', balance: 200, openingBalance: 200 }];
    const posted = postFinanceTransaction(seed, [], {
      id: 'e1',
      kind: 'expense',
      accountId: 'cash',
      amount: 30,
      accountAmount: 30,
      currency: 'CNY',
    });
    expect(posted.accounts[0]?.balance).toBe(170);

    const reversed = reverseTransaction(posted.accounts, posted.transactions, 'e1');
    const original = reversed.transactions.find((item) => item.id === 'e1') as ReverseFields | undefined;

    expect(original?.status).toBe('reversed');
    expect(original?.reversedBy).toBe('rev-e1');
    expect(reversed.transactions.find((item) => (item as ReverseFields).reversesId === 'e1')?.postings).toEqual([{ accountId: 'cash', amount: 30, currency: 'CNY' }]);
    expect(reversed.accounts[0]?.balance).toBe(200);
    expect(derivedAccountBalance(reversed.accounts[0]!, reversed.transactions)).toBe(200);
    expect(monthlyFinanceSummary(reversed.transactions, 'CNY')).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  it('is idempotent when the transaction is already reversed', () => {
    const seed = [{ id: 'cash', type: '资金账户', currency: 'CNY', balance: 50, openingBalance: 50 }];
    const posted = postFinanceTransaction(seed, [], {
      id: 'e1',
      kind: 'expense',
      accountId: 'cash',
      amount: 10,
      accountAmount: 10,
      currency: 'CNY',
    });
    const once = reverseTransaction(posted.accounts, posted.transactions, 'e1');
    const twice = reverseTransaction(once.accounts, once.transactions, 'e1');
    expect(twice.transactions.filter((item) => (item as ReverseFields).reversesId === 'e1')).toHaveLength(1);
    expect(twice.accounts[0]?.balance).toBe(50);
  });
});
