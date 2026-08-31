import { accountRole, applyDailyPriceQuotes, applyLedger, canApplyLedger, isDebtRole, migrateLegacyReimbursementAccounts, type DailyPriceQuote, type LedgerAccount, type LinkedLedgerTxn, type WealthAccount } from './product-logic';

export const ACCOUNT_TYPES = ['资金账户', '储蓄卡', '现金', '信用卡', '理财账户', '储值账户', '待收回', '欠款', '物品资产'] as const;
export const FINANCE_TABS = ['总览', '账户', '流水', '投资', '周期账单'] as const;

export type LedgerPosting = { accountId: string; amount: number; currency: string };

export type PostedAccount = LedgerAccount & { openingBalance: number };

export type PostedTransaction = LinkedLedgerTxn & {
  amount?: number;
  currency?: string;
  targetAmount?: number;
  targetCurrency?: string;
  exchangeRate?: number;
  postings?: LedgerPosting[];
  merchant?: string;
  category?: string;
  source?: string;
  createdAt?: string;
  kind: LinkedLedgerTxn['kind'] | 'adjustment' | 'settlement';
};

export type TransactionDraft = {
  id?: string;
  kind: PostedTransaction['kind'];
  accountId: string;
  targetAccountId?: string;
  amount?: number;
  accountAmount?: number;
  currency?: string;
  targetAmount?: number;
  targetCurrency?: string;
  reimbursable?: boolean;
  reimburseAccountId?: string;
  reimbursed?: boolean;
  source?: string;
  createdAt?: string;
  merchant?: string;
  category?: string;
  postings?: LedgerPosting[];
};

function moneyAmount(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (Number.isFinite(value) && Math.abs(value as number) > 0) return Math.abs(value as number);
  }
  const fallback = values.find((value) => Number.isFinite(value));
  return Math.abs(Number(fallback ?? 0));
}

export function resolveTransferAmounts(input: { sourceCurrency: string; targetCurrency: string; amount: number; rate?: number; targetAmount?: number }): { sourceAmount: number; targetAmount: number; rate: number } {
  const sourceAmount = Math.abs(input.amount);
  if (input.sourceCurrency === input.targetCurrency) {
    return { sourceAmount, targetAmount: sourceAmount, rate: 1 };
  }
  const targetAmount = Number.isFinite(input.targetAmount) ? Math.abs(Number(input.targetAmount)) : sourceAmount * (input.rate && input.rate > 0 ? input.rate : 1);
  const rate = sourceAmount ? targetAmount / sourceAmount : 1;
  return { sourceAmount, targetAmount, rate };
}

export function composeTransactionPostings(accounts: LedgerAccount[], draft: TransactionDraft): LedgerPosting[] {
  if (draft.postings?.length) return draft.postings;
  const source = accounts.find((account) => account.id === draft.accountId);
  if (!source) return [];
  const sourceCurrency = draft.currency || source.currency;
  const sourceAmount = moneyAmount(draft.accountAmount, draft.amount);
  const sourceRole = accountRole(source.type);
  const sourceDebt = isDebtRole(sourceRole);
  const postings: LedgerPosting[] = [];

  const push = (accountId: string, amount: number, currency: string) => {
    if (!amount) return;
    postings.push({ accountId, amount, currency });
  };

  if (draft.kind === 'adjustment') {
    const signed = Number(draft.accountAmount ?? draft.amount ?? 0);
    push(source.id, signed, sourceCurrency);
    return postings;
  }

  if (draft.kind === 'expense') {
    push(source.id, sourceDebt ? sourceAmount : -sourceAmount, sourceCurrency);
    if (draft.reimbursable && draft.reimburseAccountId) {
      const claim = accounts.find((account) => account.id === draft.reimburseAccountId);
      const claimCurrency = draft.targetCurrency || claim?.currency || sourceCurrency;
      const claimAmount = moneyAmount(draft.targetAmount, claimCurrency === sourceCurrency ? sourceAmount : draft.targetAmount, sourceAmount);
      push(draft.reimburseAccountId, claimAmount, claimCurrency);
    }
    return postings;
  }

  if (draft.kind === 'income') {
    push(source.id, sourceDebt ? -sourceAmount : sourceAmount, sourceCurrency);
    return postings;
  }

  const target = accounts.find((account) => account.id === draft.targetAccountId);
  if ((draft.kind === 'transfer' || draft.kind === 'settlement') && target) {
    const amounts = resolveTransferAmounts({
      sourceCurrency,
      targetCurrency: draft.targetCurrency || target.currency,
      amount: sourceAmount,
      targetAmount: draft.targetAmount,
    });
    push(source.id, sourceDebt ? amounts.sourceAmount : -amounts.sourceAmount, sourceCurrency);
    const targetDebt = isDebtRole(accountRole(target.type));
    push(target.id, targetDebt ? -amounts.targetAmount : amounts.targetAmount, amounts.sourceAmount && target.currency ? (draft.targetCurrency || target.currency) : target.currency);
    return postings;
  }
  return postings;
}

export function applyPostings<T extends LedgerAccount>(accounts: T[], postings: LedgerPosting[], factor: 1 | -1 = 1): T[] {
  const deltas = new Map<string, number>();
  for (const posting of postings) {
    deltas.set(posting.accountId, (deltas.get(posting.accountId) ?? 0) + posting.amount * factor);
  }
  return accounts.map((account) => {
    const delta = deltas.get(account.id) ?? 0;
    if (!delta) return account;
    const next = account.balance + delta;
    return { ...account, balance: isDebtRole(accountRole(account.type)) ? Math.max(0, next) : next };
  });
}

export function canApplyPostings(accounts: LedgerAccount[], postings: LedgerPosting[], factor: 1 | -1 = 1): boolean {
  return accounts.every((account) => {
    if (!isDebtRole(accountRole(account.type))) return true;
    const delta = postings.filter((posting) => posting.accountId === account.id).reduce((sum, posting) => sum + posting.amount, 0) * factor;
    return account.balance + delta >= 0;
  });
}

export function derivedAccountBalance(account: { id: string; openingBalance?: number; balance?: number }, transactions: Array<{ postings?: LedgerPosting[] }>): number {
  const opening = Number.isFinite(account.openingBalance) ? Number(account.openingBalance) : Number(account.balance ?? 0);
  const posted = transactions.reduce((sum, transaction) => (
    sum + (transaction.postings ?? []).filter((posting) => posting.accountId === account.id).reduce((inner, posting) => inner + posting.amount, 0)
  ), 0);
  return opening + posted;
}

function withDerivedBalances<T extends LedgerAccount>(accounts: T[], transactions: Array<{ postings?: LedgerPosting[] }>): Array<T & { openingBalance: number }> {
  return accounts.map((account) => {
    const openingBalance = Number.isFinite((account as T & { openingBalance?: number }).openingBalance)
      ? Number((account as T & { openingBalance?: number }).openingBalance)
      : account.balance;
    const balance = derivedAccountBalance({ ...account, openingBalance }, transactions);
    return { ...account, openingBalance, balance };
  });
}

export function migrateToPostingLedger<TA extends LedgerAccount, TT extends TransactionDraft>(
  accounts: TA[],
  transactions: TT[],
): { accounts: Array<TA & { openingBalance: number; balance: number }>; transactions: Array<TT & { postings: LedgerPosting[] }> } {
  const postedTransactions = transactions.map((transaction) => ({
    ...transaction,
    postings: transaction.postings?.length ? transaction.postings : composeTransactionPostings(accounts, transaction),
  }));
  const nextAccounts = accounts.map((account) => {
    const posted = postedTransactions.reduce((sum, transaction) => (
      sum + transaction.postings.filter((posting) => posting.accountId === account.id).reduce((inner, posting) => inner + posting.amount, 0)
    ), 0);
    const openingBalance = Number.isFinite((account as TA & { openingBalance?: number }).openingBalance) && (account as TA & { openingBalance?: number }).openingBalance !== undefined
      ? Number((account as TA & { openingBalance?: number }).openingBalance)
      : account.balance - posted;
    return { ...account, openingBalance, balance: openingBalance + posted };
  });
  return { accounts: nextAccounts, transactions: postedTransactions };
}

export function postFinanceTransaction<TA extends LedgerAccount, TT extends TransactionDraft>(
  accounts: TA[],
  transactions: TT[],
  draft: TT,
): { accounts: Array<TA & { openingBalance: number }>; transactions: Array<TT & { postings: LedgerPosting[] }> } {
  const current = migrateToPostingLedger(accounts, transactions);
  const postings = composeTransactionPostings(current.accounts, draft);
  if (!canApplyPostings(current.accounts, postings)) {
    return current;
  }
  const transaction = { ...draft, postings, accountAmount: moneyAmount(draft.accountAmount, draft.amount), kind: draft.kind } as TT & { postings: LedgerPosting[] };
  const nextTransactions = [transaction, ...current.transactions];
  return {
    accounts: applyPostings(current.accounts, postings, 1).map((account) => ({
      ...account,
      openingBalance: account.openingBalance,
    })),
    transactions: nextTransactions,
  };
}

export function postBalanceAdjustment<TA extends LedgerAccount, TT extends TransactionDraft>(
  accounts: TA[],
  transactions: TT[],
  input: { id: string; accountId: string; targetBalance: number; createdAt?: string },
): { accounts: Array<TA & { openingBalance: number }>; transactions: Array<TT & { postings: LedgerPosting[] }> } {
  const current = migrateToPostingLedger(accounts, transactions);
  const account = current.accounts.find((item) => item.id === input.accountId);
  if (!account) return current;
  const currentBalance = derivedAccountBalance(account, current.transactions);
  const delta = input.targetBalance - currentBalance;
  return postFinanceTransaction(current.accounts, current.transactions, {
    id: input.id,
    kind: 'adjustment',
    accountId: input.accountId,
    amount: Math.abs(delta),
    accountAmount: delta,
    currency: account.currency,
    createdAt: input.createdAt,
    merchant: '余额调整',
    category: '调整',
    source: 'adjustment',
  } as TT);
}

export function investmentAccountSnapshot(
  account: { id: string; openingBalance?: number; balance?: number },
  holdings: Array<{ accountId: string; quantity: number; currentPrice: number }>,
): { cash: number; marketValue: number; total: number } {
  const cash = Number.isFinite(account.balance) ? Number(account.balance) : Number(account.openingBalance ?? 0);
  const marketValue = holdings.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + item.quantity * item.currentPrice, 0);
  return { cash, marketValue, total: cash + marketValue };
}

export function migrateInvestmentCash<TA extends LedgerAccount>(
  accounts: TA[],
  holdings: Array<{ id?: string; accountId: string; quantity: number; currentPrice: number }>,
): Array<TA & { openingBalance?: number }> {
  return accounts.map((account) => {
    if (!/理财账户/.test(account.type)) return account;
    const existingOpening = (account as TA & { openingBalance?: number }).openingBalance;
    if (Number.isFinite(existingOpening)) return { ...account, openingBalance: Number(existingOpening) };
    const market = holdings.filter((item) => item.accountId === account.id).reduce((sum, item) => sum + item.quantity * item.currentPrice, 0);
    const cash = Math.abs(account.balance - market) < 0.01 ? 0 : account.balance - market;
    return { ...account, openingBalance: cash, balance: cash };
  });
}

export function normalizeFinanceRecords<TA extends WealthAccount & { id: string; type: string; currency: string; balance: number }, TT extends TransactionDraft>(
  accounts: TA[],
  transactions: TT[],
  holdings: Array<{ accountId: string; quantity: number; currentPrice: number }> = [],
): { accounts: Array<TA & { openingBalance: number }>; transactions: Array<TT & { postings: LedgerPosting[] }> } {
  const legacy = migrateLegacyReimbursementAccounts(accounts, transactions);
  const subscribed = migrateSubscriptionAccounts(legacy.accounts);
  const cashSeparated = migrateInvestmentCash(subscribed, holdings);
  const posted = migrateToPostingLedger(cashSeparated, legacy.transactions);
  return {
    accounts: posted.accounts,
    transactions: posted.transactions.map((item) => ({
      ...item,
      reimburseAccountId: item.reimburseAccountId,
    })),
  };
}

export function refreshHoldingsValuation<TA extends LedgerAccount, TH extends { id: string; currentPrice: number; updatedAt: string; quoteStatus: unknown; history: { date: string; price: number }[] }>(
  accounts: TA[],
  holdings: TH[],
  quotes: DailyPriceQuote[],
): { accounts: TA[]; holdings: TH[] } {
  return { accounts, holdings: applyDailyPriceQuotes(holdings, quotes) };
}

export function isMonthlyIncome(transaction: { kind?: string; category?: string; reimbursementForId?: string }): boolean {
  if (transaction.kind !== 'income') return false;
  if (transaction.reimbursementForId) return false;
  if (transaction.category === '报销入账') return false;
  return true;
}

export function monthlyIncomeTotal(transactions: Array<{ kind?: string; category?: string; reimbursementForId?: string; currency?: string; amount?: number; accountAmount?: number }>, currency: string): number {
  return transactions.filter((item) => isMonthlyIncome(item) && (item.currency || 'CNY') === currency).reduce((sum, item) => sum + Math.abs(Number(item.accountAmount ?? item.amount ?? 0)), 0);
}

export function reimbursementOutstandingAmount(original: { amount?: number; accountAmount?: number; targetAmount?: number; currency?: string; targetCurrency?: string }): { amount: number; currency: string } {
  return {
    amount: moneyAmount(original.targetAmount, original.accountAmount, original.amount),
    currency: original.targetCurrency || original.currency || 'CNY',
  };
}

export function buildReimbursementSettlement(
  original: { id: string; reimburseAccountId?: string; accountAmount?: number; amount?: number; currency?: string },
  input: { id: string; counterpartId: string; amount: number; currency: string },
): PostedTransaction {
  const claimId = original.reimburseAccountId || '';
  const amount = Math.abs(input.amount);
  return {
    id: input.id,
    kind: 'settlement',
    accountId: claimId,
    targetAccountId: input.counterpartId,
    accountAmount: amount,
    amount,
    currency: input.currency,
    reimbursable: false,
    reimbursementForId: original.id,
    postings: [
      { accountId: claimId, amount: -amount, currency: input.currency },
      { accountId: input.counterpartId, amount, currency: input.currency },
    ],
  };
}

export function migrateSubscriptionAccounts<TA extends LedgerAccount>(accounts: TA[]): TA[] {
  return accounts.map((account) => /订阅/.test(account.type) ? { ...account, type: '资金账户' } as TA : account);
}

export function canDeleteAccount(input: {
  accountId: string;
  accounts: Array<{ id: string; balance?: number }>;
  transactions: Array<{ postings?: LedgerPosting[]; accountId?: string; targetAccountId?: string }>;
  holdings: Array<{ accountId?: string }>;
  rules: Array<{ accountId?: string; targetAccountId?: string }>;
}): { ok: boolean; reason?: string } {
  const account = input.accounts.find((item) => item.id === input.accountId);
  if (!account) return { ok: false, reason: '账户不存在' };
  if (Math.abs(Number(account.balance ?? 0)) > 0.0001) return { ok: false, reason: '账户余额不为 0' };
  const hasPosting = input.transactions.some((item) => item.accountId === input.accountId || item.targetAccountId === input.accountId || item.postings?.some((posting) => posting.accountId === input.accountId));
  if (hasPosting) return { ok: false, reason: '账户仍有流水' };
  if (input.holdings.some((item) => item.accountId === input.accountId)) return { ok: false, reason: '账户仍有持仓' };
  if (input.rules.some((item) => item.accountId === input.accountId || item.targetAccountId === input.accountId)) return { ok: false, reason: '账户仍被周期账单使用' };
  return { ok: true };
}

export function financeTransactionFields(kind: 'expense' | 'income' | 'transfer' | 'adjustment', flags: { reimbursable?: boolean; sameCurrency?: boolean } = {}): string[] {
  if (kind === 'transfer') {
    const fields = ['kind', 'amount', 'currency', 'merchant', 'accountId', 'targetAccountId'];
    if (flags.sameCurrency === false) fields.push('rate', 'targetAmount');
    return fields;
  }
  if (kind === 'expense') {
    const fields = ['kind', 'amount', 'currency', 'merchant', 'category', 'accountId', 'reimbursable'];
    if (flags.reimbursable) fields.push('reimburseAccountId');
    return fields;
  }
  if (kind === 'income') return ['kind', 'amount', 'currency', 'merchant', 'accountId'];
  return ['kind', 'amount', 'currency', 'merchant', 'accountId'];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function runFinanceInvariantSequence(seed: number, steps: number): { ok: boolean; violations: string[] } {
  const random = mulberry32(seed);
  let accounts: PostedAccount[] = [
    { id: 'cash', type: '资金账户', currency: 'CNY', balance: 1000, openingBalance: 1000 },
    { id: 'card', type: '信用卡', currency: 'CNY', balance: 100, openingBalance: 100 },
    { id: 'claim', type: '待收回', currency: 'CNY', balance: 0, openingBalance: 0 },
    { id: 'owe', type: '欠款', currency: 'CNY', balance: 80, openingBalance: 80 },
    { id: 'inv', type: '理财账户', currency: 'CNY', balance: 50, openingBalance: 50 },
  ];
  let transactions: Array<PostedTransaction> = [];
  let holdings = [{ id: 'h1', accountId: 'inv', quantity: 10, currentPrice: 3, updatedAt: '2026-08-01', quoteStatus: 'manual' as const, history: [{ date: '08-01', price: 3 }] }];
  const violations: string[] = [];

  const check = (label: string) => {
    const migrated = migrateToPostingLedger(accounts, transactions);
    for (const account of migrated.accounts) {
      const derived = derivedAccountBalance(account, migrated.transactions);
      if (Math.abs(derived - account.balance) > 0.001) violations.push(`${label}: ${account.id} derived ${derived} != balance ${account.balance}`);
    }
    const claim = migrated.accounts.find((item) => item.id === 'claim');
    const openClaims = migrated.transactions.filter((item) => item.kind === 'expense' && item.reimbursable && !item.reimbursed && item.reimburseAccountId === 'claim');
    const claimed = openClaims.reduce((sum, item) => sum + moneyAmount(item.accountAmount, item.amount), 0);
    if (Math.abs((claim?.balance ?? 0) - claimed) > 0.001) violations.push(`${label}: receivable ${claim?.balance} != open claims ${claimed}`);
    const snapshot = investmentAccountSnapshot(migrated.accounts.find((item) => item.id === 'inv')!, holdings);
    const market = holdings.filter((item) => item.accountId === 'inv').reduce((sum, item) => sum + item.quantity * item.currentPrice, 0);
    if (Math.abs(snapshot.marketValue - market) > 0.001 || Math.abs(snapshot.total - (snapshot.cash + market)) > 0.001) {
      violations.push(`${label}: investment total mismatch`);
    }
    accounts = migrated.accounts;
    transactions = migrated.transactions;
  };

  check('seed');
  for (let index = 0; index < steps; index += 1) {
    const roll = random();
    const cash = accounts.find((item) => item.id === 'cash')!;
    const card = accounts.find((item) => item.id === 'card')!;
    const owe = accounts.find((item) => item.id === 'owe')!;
    if (roll < 0.18 && cash.balance >= 10) {
      const posted = postFinanceTransaction(accounts, transactions, { id: `e-${index}`, kind: 'expense', accountId: 'cash', amount: 10, accountAmount: 10, currency: 'CNY', source: random() < 0.5 ? 'manual' : 'notification' });
      accounts = posted.accounts;
      transactions = posted.transactions;
    } else if (roll < 0.32) {
      const posted = postFinanceTransaction(accounts, transactions, { id: `c-${index}`, kind: 'expense', accountId: 'card', amount: 8, accountAmount: 8, currency: 'CNY' });
      accounts = posted.accounts;
      transactions = posted.transactions;
    } else if (roll < 0.46 && cash.balance >= 12) {
      const posted = postFinanceTransaction(accounts, transactions, {
        id: `r-${index}`,
        kind: 'expense',
        accountId: 'cash',
        amount: 12,
        accountAmount: 12,
        currency: 'CNY',
        reimbursable: true,
        reimburseAccountId: 'claim',
      });
      accounts = posted.accounts;
      transactions = posted.transactions;
    } else if (roll < 0.58) {
      const open = transactions.find((item) => item.kind === 'expense' && item.reimbursable && !item.reimbursed);
      if (open) {
        const settlement = buildReimbursementSettlement(open, { id: `s-${index}`, counterpartId: 'cash', amount: moneyAmount(open.accountAmount, open.amount), currency: 'CNY' });
        const nextAccounts = applyPostings(accounts, settlement.postings ?? [], 1);
        accounts = nextAccounts;
        transactions = [
          { ...settlement, reimbursed: false },
          ...transactions.map((item) => item.id === open.id ? { ...item, reimbursed: true, reimbursementTransactionId: settlement.id } : item),
        ];
      }
    } else if (roll < 0.7 && cash.balance >= 5 && owe.balance >= 5) {
      const posted = postFinanceTransaction(accounts, transactions, { id: `p-${index}`, kind: 'transfer', accountId: 'cash', targetAccountId: 'owe', amount: 5, accountAmount: 5, currency: 'CNY' });
      accounts = posted.accounts;
      transactions = posted.transactions;
    } else if (roll < 0.82) {
      const next = postBalanceAdjustment(accounts, transactions, { id: `a-${index}`, accountId: 'cash', targetBalance: cash.balance + 7 });
      accounts = next.accounts;
      transactions = next.transactions;
    } else if (roll < 0.9 && transactions.length) {
      const victim = transactions[Math.floor(random() * transactions.length)];
      const removed = removePostedTransaction(accounts, transactions, victim.id);
      accounts = removed.accounts;
      transactions = removed.transactions;
    } else {
      const price = 2 + random() * 4;
      const refreshed = refreshHoldingsValuation(accounts, holdings, [{ holdingId: 'h1', price, asOf: `2026-08-${String((index % 27) + 1).padStart(2, '0')}T18:00:00`, source: 'stooq' }]);
      holdings = refreshed.holdings;
    }
    void card;
    check(`step-${index}`);
    if (violations.length > 8) break;
  }
  return { ok: violations.length === 0, violations };
}

export function removePostedTransaction<TA extends LedgerAccount, TT extends PostedTransaction>(
  accounts: TA[],
  transactions: TT[],
  id: string,
): { accounts: TA[]; transactions: TT[] } {
  const previous = transactions.find((item) => item.id === id);
  if (!previous) return { accounts, transactions };
  const postings = previous.postings?.length ? previous.postings : composeTransactionPostings(accounts, previous);
  let nextAccounts = applyPostings(accounts, postings, -1);
  let nextTransactions = transactions.filter((item) => item.id !== previous.id);
  if (previous.reimbursementForId) {
    nextTransactions = nextTransactions.map((item) => item.id === previous.reimbursementForId
      ? { ...item, reimbursed: false, reimbursementTransactionId: undefined }
      : item);
  }
  if (previous.reimbursementTransactionId) {
    const credit = transactions.find((item) => item.id === previous.reimbursementTransactionId);
    if (credit) nextAccounts = applyPostings(nextAccounts, credit.postings?.length ? credit.postings : composeTransactionPostings(nextAccounts, credit), -1);
    nextTransactions = nextTransactions.filter((item) => item.id !== previous.reimbursementTransactionId);
  }
  return { accounts: nextAccounts, transactions: nextTransactions };
}

export function settlePostedReimbursement<TA extends LedgerAccount, TT extends PostedTransaction>(
  accounts: TA[],
  transactions: TT[],
  originalId: string,
  credit: TT,
): { accounts: TA[]; transactions: TT[] } {
  const original = transactions.find((item) => item.id === originalId);
  if (!original?.reimbursable || original.reimbursed) return { accounts, transactions };
  const linked = { ...credit, reimbursementForId: original.id } as TT;
  const postings = linked.postings?.length ? linked.postings : composeTransactionPostings(accounts, linked);
  const claimId = original.reimburseAccountId;
  const touchesClaim = Boolean(claimId && (linked.accountId === claimId || linked.targetAccountId === claimId || postings.some((posting) => posting.accountId === claimId)));
  let nextAccounts = applyPostings(accounts, postings, 1);
  if (claimId && !touchesClaim && (linked.kind === 'income') && canApplyLedger(nextAccounts, { kind: 'expense', accountId: claimId, accountAmount: original.accountAmount })) {
    nextAccounts = applyLedger(nextAccounts, { kind: 'expense', accountId: claimId, accountAmount: original.accountAmount }, 1);
  }
  return {
    accounts: nextAccounts,
    transactions: [
      { ...linked, postings },
      ...transactions.map((item) => item.id === original.id ? { ...item, reimbursed: true, reimbursementTransactionId: linked.id } as TT : item),
    ],
  };
}
