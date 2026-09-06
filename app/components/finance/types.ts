export type Currency = 'CNY' | 'USD' | 'HKD' | 'EUR' | 'JPY';
export type TransactionKind = 'expense' | 'income' | 'transfer' | 'adjustment' | 'settlement';

export type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: Currency;
  tone: 'forest' | 'clay' | 'ink';
  openingBalance?: number;
};

export type LedgerPosting = { accountId: string; amount: number; currency: string };

export type Transaction = {
  id: string;
  kind: TransactionKind;
  amount: number;
  accountAmount: number;
  currency: Currency;
  merchant: string;
  category: string;
  accountId: string;
  targetAccountId?: string;
  targetAmount?: number;
  targetCurrency?: Currency;
  exchangeRate?: number;
  source: string;
  reimbursable: boolean;
  reimburseAccountId?: string;
  reimbursed?: boolean;
  reimbursementForId?: string;
  reimbursementTransactionId?: string;
  recurringRuleId?: string;
  createdAt: string;
  occurredAt?: string;
  occurredAtEstimated?: boolean;
  postings?: LedgerPosting[];
  idempotencyKey?: string;
  status?: 'draft' | 'confirmed' | 'reversed' | 'superseded';
  reversesId?: string;
  reversedBy?: string;
};

export type RecurringRule = {
  id: string;
  name: string;
  kind: 'subscription' | 'credit-card';
  amount: number;
  currency: Currency;
  accountId: string;
  targetAccountId?: string;
  dueDay: number;
  enabled: boolean;
  lastRunPeriod?: string;
};

export type InvestmentKind = 'fund' | 'stock' | 'crypto' | 'meme';
export type PricePoint = { date: string; price: number };
export type InvestmentHolding = {
  id: string;
  accountId: string;
  kind: InvestmentKind;
  name: string;
  code: string;
  contract: string;
  network: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currency: Currency;
  updatedAt: string;
  quoteStatus: 'sample' | 'manual' | 'live';
  history: PricePoint[];
};

export type ExchangeRate = {
  currency: string;
  cnyRate: number;
  asOf: string;
  source: 'manual' | 'daily';
  updatedAt: string;
};

export type FinanceData = {
  accounts: Account[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  investments: InvestmentHolding[];
  exchangeRates: ExchangeRate[];
};

export const FINANCE_SECTIONS = ['总览', '账户', '投资', '周期账单', '流水'] as const;
export type FinanceSection = (typeof FINANCE_SECTIONS)[number];
export const FINANCE_CURRENCIES: Currency[] = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'];
