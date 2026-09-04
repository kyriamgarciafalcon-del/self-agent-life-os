import {
  cnyWealthTotal,
  investmentAccountSnapshot,
  monthlyFinanceSummary,
  wealthTotals,
  type ExchangeRate,
  type WealthAccount,
  type WealthHolding,
  type WealthTxn,
} from './product-logic';
import type { MonthlyFinanceTransaction } from './finance-core';

export function getNetWorth(
  accounts: WealthAccount[],
  transactions: WealthTxn[] = [],
  holdings: WealthHolding[] = [],
) {
  return wealthTotals(accounts, transactions, holdings);
}

export function getMonthlyReport(transactions: MonthlyFinanceTransaction[], currency: string) {
  return monthlyFinanceSummary(transactions, currency);
}

export function transactionOccurredAt(item: { occurredAt?: string; createdAt?: string }): string {
  return item.occurredAt || item.createdAt || '';
}

export function transactionsInPeriod<T extends { occurredAt?: string; createdAt?: string }>(items: T[], period: string): T[] {
  return items.filter((item) => transactionOccurredAt(item).startsWith(period));
}

export function getReceivables(
  accounts: WealthAccount[],
  transactions: WealthTxn[] = [],
  holdings: WealthHolding[] = [],
) {
  return getNetWorth(accounts, transactions, holdings).reduce((sum, line) => sum + line.receivable, 0);
}

export function getInvestmentValue(
  accounts: Array<{ id?: string; type: string; openingBalance?: number; balance?: number }>,
  holdings: Array<{ accountId: string; quantity: number; currentPrice: number }>,
) {
  return accounts
    .filter((account) => account.id && /理财账户/.test(account.type))
    .reduce(
      (sum, account) => {
        const snapshot = investmentAccountSnapshot(
          { id: account.id as string, openingBalance: account.openingBalance, balance: account.balance },
          holdings,
        );
        return {
          cash: sum.cash + snapshot.cash,
          marketValue: sum.marketValue + snapshot.marketValue,
          total: sum.total + snapshot.total,
        };
      },
      { cash: 0, marketValue: 0, total: 0 },
    );
}

export function getConvertedNetWorth(
  accounts: WealthAccount[],
  transactions: WealthTxn[] = [],
  rates: ExchangeRate[] = [],
  holdings: WealthHolding[] = [],
) {
  return cnyWealthTotal(accounts, transactions, rates, holdings);
}
