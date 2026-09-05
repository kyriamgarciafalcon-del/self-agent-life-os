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
import { isActivePosted, reimbursementOutstandingAmount, type MonthlyFinanceTransaction } from './finance-core';
import { moneySum, moneyToMajor } from './money';

// A scalar total must never silently add different currencies.
function selectCurrency(currencies: string[], requested?: string): string | undefined {
  const unique = [...new Set(currencies)];
  if (!requested && unique.length > 1) throw new Error('Mixed currencies require an explicit currency');
  return requested || unique[0];
}

type ReimbursementTransaction = MonthlyFinanceTransaction & {
  id?: string; reimbursable?: boolean; reimbursed?: boolean;
  targetAmount?: number; targetCurrency?: string;
};

export function getOutstandingReimbursements(transactions: ReimbursementTransaction[], currency: string): number {
  const amounts = transactions
    .filter((item) => item.kind === 'expense' && item.reimbursable && !item.reimbursed && isActivePosted(item))
    .map((item) => reimbursementOutstandingAmount(item, transactions))
    .filter((item) => item.currency === currency)
    .map((item) => item.amount);
  return moneyToMajor(moneySum(currency, amounts));
}

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
  currency?: string,
) {
  const lines = getNetWorth(accounts, transactions, holdings);
  const selected = selectCurrency(lines.map((line) => line.currency), currency);
  return lines.find((line) => line.currency === selected)?.receivable ?? 0;
}

export function getInvestmentValue(
  accounts: Array<{ id?: string; type: string; currency: string; openingBalance?: number; balance?: number }>,
  holdings: Array<{ accountId: string; quantity: number; currentPrice: number }>,
  currency?: string,
) {
  const investments = accounts.filter((account) => account.id && /理财账户/.test(account.type));
  const selected = selectCurrency(investments.map((account) => account.currency), currency);
  return investments
    .filter((account) => account.currency === selected)
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
