export type WeekDate = { weekday: string; day: number; value: string };

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysKey(value: string, days: number): string {
  return localDateKey(addDays(parseLocalDate(value), days));
}

export function weekDates(anchor: string): WeekDate[] {
  const date = parseLocalDate(anchor);
  const offset = (date.getDay() + 6) % 7;
  const monday = addDays(date, -offset);
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  return weekdays.map((weekday, index) => {
    const current = addDays(monday, index);
    return { weekday, day: current.getDate(), value: localDateKey(current) };
  });
}

export type NaturalCapture =
  | { kind: 'expense'; amount: number; merchant: string; category: string; source: '微信' | '支付宝' | '银行卡' }
  | { kind: 'schedule'; title: string; date: string; time: string };

function categoryForText(text: string): string {
  if (/饭|餐|咖啡|奶茶|菜/.test(text)) return '餐饮';
  if (/车|地铁|公交|打车|加油/.test(text)) return '交通';
  if (/药|医院|挂号/.test(text)) return '医疗';
  if (/会员|订阅|话费|电费|水费/.test(text)) return '生活';
  return '其他';
}

export function parseNaturalCapture(text: string, today = localDateKey()): NaturalCapture {
  const amountMatch = text.match(/(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块)/);
  if (amountMatch && /花|付|买|消费|微信|支付宝|银行卡|银行|元|块/.test(text)) {
    const source = /支付宝/.test(text) ? '支付宝' : /银行卡|银行/.test(text) ? '银行卡' : '微信';
    const merchant = text
      .replace(amountMatch[0], ' ')
      .replace(/微信支付|支付宝支付|银行卡支付|微信|支付宝|银行卡|银行|花了|支付|付款|消费|买了|用了|用/g, ' ')
      .replace(/[，。,.!！?？、]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '待补充商家';
    return { kind: 'expense', amount: Number(amountMatch[1]), merchant, category: categoryForText(text), source };
  }

  const timeMatch = text.match(/(\d{1,2})\s*(?::|：|点)\s*(\d{0,2})/);
  const hour = Math.min(Number(timeMatch?.[1] ?? 10), 23);
  const minute = Math.min(Number(timeMatch?.[2] || 0), 59);
  const date = /后天/.test(text) ? addDaysKey(today, 2) : /明天/.test(text) ? addDaysKey(today, 1) : today;
  const title = text
    .replace(/今天|明天|后天/g, ' ')
    .replace(/\d{1,2}\s*(?::|：|点)\s*\d{0,2}/, ' ')
    .replace(/提醒我|提醒|安排|日程/g, ' ')
    .replace(/[，。,.!！?？、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '新日程';
  return { kind: 'schedule', title, date, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

type ScopedSummaryInput = {
  today: string;
  month: string;
  privacy: { schedule: boolean; finance: boolean; health: boolean };
  schedules: { date: string; done: boolean; title: string }[];
  transactions: { createdAt: string }[];
  healthRecords: unknown[];
  memories: { active: boolean; title: string; note: string }[];
};

export function buildScopedSummary(input: ScopedSummaryInput): string {
  const schedule = input.privacy.schedule
    ? `日程未完成=${input.schedules.filter((item) => item.date === input.today && !item.done).map((item) => item.title).join('、') || '无'}`
    : '日程权限关闭';
  const finance = input.privacy.finance
    ? `本月流水 ${input.transactions.filter((item) => item.createdAt.startsWith(input.month)).length} 笔`
    : '财务权限关闭';
  const health = input.privacy.health ? `健康记录 ${input.healthRecords.length} 条` : '健康权限关闭';
  const memories = input.memories.filter((item) => item.active).map((item) => `${item.title}（${item.note}）`).join('；') || '无';
  return `你是 Self Agent 本机管家。只能使用这些摘要：${schedule}；${finance}；${health}；用户允许的记忆=${memories}。禁止索取或输出密码、验证码、私钥、助记词、完整卡号。健康不是诊断，财务不是投资建议。`;
}

export function detectLegacyDemoData(raw: { schedules?: { id?: string }[]; accounts?: { id?: string }[] }): boolean {
  return Boolean(raw.schedules?.some((item) => item.id === 's1') && raw.accounts?.some((item) => item.id === 'wechat'));
}

export function isBackupPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.schedules) || !Array.isArray(raw.accounts) || !Array.isArray(raw.transactions)) return false;
  const optionalArrays = ['recurringRules', 'healthRecords', 'travels', 'investments', 'memories', 'vaultItems'];
  return optionalArrays.every((key) => raw[key] === undefined || Array.isArray(raw[key]));
}

export type AssetAccount = { currency: string; balance: number };
export type AssetLine = { currency: string; amount: number };

const ASSET_CURRENCY_ORDER = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'];

export function assetTotals(accounts: AssetAccount[]): AssetLine[] {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    const currency = account.currency || 'CNY';
    const balance = Number.isFinite(account.balance) ? account.balance : 0;
    totals.set(currency, (totals.get(currency) ?? 0) + balance);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => {
      const leftRank = ASSET_CURRENCY_ORDER.indexOf(left.currency);
      const rightRank = ASSET_CURRENCY_ORDER.indexOf(right.currency);
      return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank) || left.currency.localeCompare(right.currency);
    });
}

export type AccountRole = 'asset' | 'receivable' | 'liability' | 'payable' | 'plan';

export function accountRole(type: string): AccountRole {
  if (/报销|待收回|应收/.test(type)) return 'receivable';
  if (/信用卡|待还款|信贷|花呗|白条/.test(type)) return 'liability';
  if (/欠款|应付/.test(type)) return 'payable';
  if (/订阅/.test(type)) return 'plan';
  return 'asset';
}

export function isDebtRole(role: AccountRole): boolean {
  return role === 'liability' || role === 'payable';
}

export function normalizeAccountBalance(type: string, balance: number): number {
  const value = Number.isFinite(balance) ? balance : 0;
  return isDebtRole(accountRole(type)) ? Math.abs(value) : value;
}

export type WealthAccount = { id?: string; type: string; currency: string; balance: number };
export type WealthLine = {
  currency: string;
  assets: number;
  receivable: number;
  liability: number;
  payable: number;
  net: number;
};

export type WealthTxn = {
  kind: string;
  currency?: string;
  amount?: number;
  accountAmount?: number;
  reimbursable?: boolean;
  reimbursed?: boolean;
  reimburseAccountId?: string;
};

export function wealthTotals(accounts: WealthAccount[], transactions: WealthTxn[] = []): WealthLine[] {
  const map = new Map<string, WealthLine>();
  const line = (currency: string) => map.get(currency) ?? { currency, assets: 0, receivable: 0, liability: 0, payable: 0, net: 0 };
  for (const account of accounts) {
    const currency = account.currency || 'CNY';
    const current = line(currency);
    const amount = normalizeAccountBalance(account.type, account.balance);
    const role = accountRole(account.type);
    if (role === 'asset') current.assets += amount;
    else if (role === 'receivable') current.receivable += amount;
    else if (role === 'liability') current.payable += amount;
    else if (role === 'payable') current.payable += amount;
    map.set(currency, current);
  }
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || !transaction.reimbursable || transaction.reimbursed) continue;
    const claim = accounts.find((account) => account.id === transaction.reimburseAccountId);
    if (claim && accountRole(claim.type) === 'receivable') continue;
    const currency = transaction.currency || 'CNY';
    const current = line(currency);
    current.receivable += Number(transaction.accountAmount ?? transaction.amount ?? 0);
    map.set(currency, current);
  }
  return [...map.values()]
    .map((item) => ({ ...item, liability: item.payable, net: item.assets + item.receivable - item.payable }))
    .sort((left, right) => {
      const leftRank = ASSET_CURRENCY_ORDER.indexOf(left.currency);
      const rightRank = ASSET_CURRENCY_ORDER.indexOf(right.currency);
      return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank) || left.currency.localeCompare(right.currency);
    });
}

export type ExchangeRate = {
  currency: string;
  cnyRate: number;
  asOf: string;
  source: 'manual' | 'daily';
  updatedAt: string;
};

export type CnyWealthTotal = { convertedCny: number; unresolved: AssetLine[] };

function validRateDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function cnyWealthTotal(accounts: WealthAccount[], transactions: WealthTxn[] = [], rates: ExchangeRate[] = []): CnyWealthTotal {
  const ratesByCurrency = new Map(rates.filter((rate) => Number.isFinite(rate.cnyRate) && rate.cnyRate > 0 && validRateDate(rate.asOf) && Number.isFinite(Date.parse(rate.updatedAt))).map((rate) => [rate.currency, rate]));
  let convertedCny = 0;
  const unresolved = new Map<string, number>();
  for (const line of wealthTotals(accounts, transactions)) {
    const rate = line.currency === 'CNY' ? 1 : ratesByCurrency.get(line.currency)?.cnyRate;
    if (!rate) {
      unresolved.set(line.currency, (unresolved.get(line.currency) ?? 0) + line.net);
      continue;
    }
    convertedCny += line.net * rate;
  }
  return {
    convertedCny,
    unresolved: [...unresolved.entries()].map(([currency, amount]) => ({ currency, amount })).filter((line) => line.amount !== 0),
  };
}

export type LegacyReimbursementTxn = WealthTxn & { reimburseAccountId?: string };

export function migrateLegacyReimbursementAccounts<TA extends WealthAccount & { id: string }, TT extends LegacyReimbursementTxn>(
  accounts: TA[],
  transactions: TT[],
): { accounts: TA[]; transactions: TT[] } {
  const legacyIds = new Set(accounts.filter((account) => /报销账户/.test(account.type)).map((account) => account.id));
  if (!legacyIds.size) return { accounts, transactions };
  const linkedAmount = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || !transaction.reimbursable || transaction.reimbursed || !transaction.reimburseAccountId || !legacyIds.has(transaction.reimburseAccountId)) continue;
    linkedAmount.set(transaction.reimburseAccountId, (linkedAmount.get(transaction.reimburseAccountId) ?? 0) + Math.abs(Number(transaction.accountAmount ?? transaction.amount ?? 0)));
  }
  const migratedAccounts = accounts.flatMap((account) => {
    if (!legacyIds.has(account.id)) return [account];
    const residual = Math.max(0, normalizeAccountBalance(account.type, account.balance) - (linkedAmount.get(account.id) ?? 0));
    return residual ? [{ ...account, type: '待收回', balance: residual } as TA] : [];
  });
  const migratedTransactions = transactions.map((transaction) => legacyIds.has(transaction.reimburseAccountId ?? '')
    ? { ...transaction, reimburseAccountId: undefined } as TT
    : transaction);
  return { accounts: migratedAccounts, transactions: migratedTransactions };
}

export function upsertByExternalKey<T extends { externalKey?: string }>(current: T[], incoming: T[]): T[] {
  const keys = new Set(incoming.map((item) => item.externalKey).filter((key): key is string => Boolean(key)));
  return [...incoming, ...current.filter((item) => !item.externalKey || !keys.has(item.externalKey))];
}

export type DailyPriceQuote = { holdingId: string; price: number; asOf: string; source: string };

export function applyDailyPriceQuotes<T extends { id: string; currentPrice: number; updatedAt: string; quoteStatus: unknown; history: { date: string; price: number }[] }>(holdings: T[], quotes: DailyPriceQuote[]): T[] {
  const latest = new Map<string, DailyPriceQuote>();
  for (const quote of quotes) if (quote.holdingId && Number.isFinite(quote.price) && quote.price > 0 && /^\d{4}-\d{2}-\d{2}/.test(quote.asOf)) latest.set(quote.holdingId, quote);
  return holdings.map((holding) => {
    const quote = latest.get(holding.id);
    if (!quote) return holding;
    const date = quote.asOf.slice(5, 10);
    return { ...holding, currentPrice: quote.price, updatedAt: quote.asOf, quoteStatus: 'live', history: [...holding.history.filter((point) => point.date !== date), { date, price: quote.price }].slice(-30) } as T;
  });
}

export function applyDailyFxRates(current: ExchangeRate[], incoming: ExchangeRate[]): ExchangeRate[] {
  const next = [...current];
  for (const rate of incoming) {
    if (!rate.currency || rate.currency === 'CNY' || !(rate.cnyRate > 0) || !validRateDate(rate.asOf)) continue;
    const item: ExchangeRate = { currency: rate.currency, cnyRate: rate.cnyRate, asOf: rate.asOf, source: 'daily', updatedAt: rate.updatedAt || rate.asOf };
    const index = next.findIndex((existing) => existing.currency === rate.currency);
    if (index >= 0) next[index] = item;
    else next.push(item);
  }
  return next;
}

export type LedgerAccount = { id: string; name?: string; type: string; currency: string; balance: number };
export type LedgerTxn = {
  kind: 'expense' | 'income' | 'transfer';
  accountId: string;
  targetAccountId?: string;
  accountAmount: number;
  reimbursable?: boolean;
  reimburseAccountId?: string;
  reimbursed?: boolean;
};

const POSTING_ACCOUNT_RE = /资金账户|储蓄卡|现金|储值账户|信用卡/;

export function resolvePaymentAccountId(accounts: LedgerAccount[], source?: string, accountHint?: string): string | undefined {
  const candidates = accounts.filter((account) => POSTING_ACCOUNT_RE.test(account.type));
  const exact = candidates.find((account) => account.id === source || account.id === accountHint);
  if (exact) return exact.id;
  const raw = `${source ?? ''}${accountHint ?? ''}`.toLowerCase();
  const tokens = [
    /alipay|支付宝/.test(raw) ? '支付宝' : '',
    /wechat|微信/.test(raw) ? '微信' : '',
    accountHint?.trim() ?? '',
  ].filter(Boolean);
  return candidates.find((account) => tokens.some((token) => `${account.name ?? ''}${account.type}${account.id}`.toLowerCase().includes(token.toLowerCase())))?.id;
}

export function defaultCashId(accounts: LedgerAccount[], currency: string): string | undefined {
  const matches = accounts.filter((account) => accountRole(account.type) === 'asset' && account.currency === currency && !/物品资产|理财账户/.test(account.type));
  return (matches.find((account) => /资金|储蓄|现金|支付宝|微信|银行/.test(`${account.type}${account.name ?? ''}${account.id}`)) ?? matches[0])?.id;
}

function ledgerDelta(account: LedgerAccount, transaction: LedgerTxn): number {
  const amount = transaction.accountAmount;
  const role = accountRole(account.type);
  const debt = isDebtRole(role);
  if (account.id === transaction.accountId) {
    if (transaction.kind === 'income') return debt ? -amount : amount;
    if (transaction.kind === 'expense') return debt ? amount : -amount;
    if (transaction.kind === 'transfer') return debt ? amount : -amount;
  }
  if (transaction.kind === 'expense' && transaction.reimbursable && !transaction.reimbursed && account.id === transaction.reimburseAccountId && role === 'receivable') {
    return amount;
  }
  if (transaction.kind === 'transfer' && account.id === transaction.targetAccountId) {
    return debt ? -amount : amount;
  }
  return 0;
}

export function canApplyLedger(accounts: LedgerAccount[], transaction: LedgerTxn, factor: 1 | -1 = 1): boolean {
  return accounts.every((account) => !isDebtRole(accountRole(account.type)) || account.balance + ledgerDelta(account, transaction) * factor >= 0);
}

export function applyLedger<T extends LedgerAccount>(accounts: T[], transaction: LedgerTxn, factor: 1 | -1): T[] {
  if (!canApplyLedger(accounts, transaction, factor)) return accounts;
  return accounts.map((account) => {
    const delta = ledgerDelta(account, transaction) * factor;
    if (!delta) return account;
    const next = account.balance + delta;
    return { ...account, balance: isDebtRole(accountRole(account.type)) ? Math.max(0, next) : next };
  });
}

export type SettlementPlan =
  | { ok: true; transaction: LedgerTxn }
  | { ok: false; reason: string };

export function planAccountSettlement(accounts: LedgerAccount[], accountId: string, counterpartId: string, amount: number): SettlementPlan {
  const account = accounts.find((item) => item.id === accountId);
  const counterpart = accounts.find((item) => item.id === counterpartId);
  if (!account || account.balance <= 0) return { ok: false, reason: '没有可结算的余额' };
  if (!counterpart || counterpart.id === account.id) return { ok: false, reason: '请选择另一个账户' };
  if (counterpart.currency !== account.currency) return { ok: false, reason: '请选择同币种账户' };
  if (!(amount > 0)) return { ok: false, reason: '请输入大于 0 的金额' };
  if (amount > account.balance) return { ok: false, reason: '金额不能超过当前余额' };
  const counterpartIsCash = accountRole(counterpart.type) === 'asset' && !/物品资产|订阅账户/.test(counterpart.type);
  if (!counterpartIsCash) return { ok: false, reason: '请选择资金账户' };
  const role = accountRole(account.type);
  if (role === 'receivable') {
    const transaction: LedgerTxn = { kind: 'transfer', accountId: account.id, targetAccountId: counterpart.id, accountAmount: amount };
    return { ok: true, transaction };
  }
  if (isDebtRole(role)) {
    const transaction: LedgerTxn = { kind: 'transfer', accountId: counterpart.id, targetAccountId: account.id, accountAmount: amount };
    if (!canApplyLedger(accounts, transaction)) return { ok: false, reason: '资金账户余额不足，或超过当前欠款' };
    return { ok: true, transaction };
  }
  return { ok: false, reason: '这个账户不需要收回或还款' };
}

export type LinkedLedgerTxn = LedgerTxn & {
  id: string;
  reimbursementForId?: string;
  reimbursementTransactionId?: string;
};

export function settleReimbursementState<TA extends LedgerAccount, TT extends LinkedLedgerTxn>(
  accounts: TA[],
  transactions: TT[],
  originalId: string,
  credit: TT,
): { accounts: TA[]; transactions: TT[] } {
  const original = transactions.find((item) => item.id === originalId);
  if (!original?.reimbursable || original.reimbursed) return { accounts, transactions };
  const linkedCredit = { ...credit, reimbursementForId: original.id } as TT;
  let nextAccounts = applyLedger(accounts, linkedCredit, 1);
  const claim = accounts.find((account) => account.id === original.reimburseAccountId);
  if (claim && accountRole(claim.type) === 'receivable') {
    nextAccounts = applyLedger(nextAccounts, { kind: 'expense', accountId: claim.id, accountAmount: original.accountAmount }, 1);
  }
  return {
    accounts: nextAccounts,
    transactions: [
      linkedCredit,
      ...transactions.map((item) => item.id === original.id
        ? { ...item, reimbursed: true, reimbursementTransactionId: linkedCredit.id } as TT
        : item),
    ],
  };
}

export function removeLedgerTransactionState<TA extends LedgerAccount, TT extends LinkedLedgerTxn>(
  accounts: TA[],
  transactions: TT[],
  id: string,
): { accounts: TA[]; transactions: TT[] } {
  const previous = transactions.find((item) => item.id === id);
  if (!previous) return { accounts, transactions };
  let nextAccounts = applyLedger(accounts, previous, -1);
  let nextTransactions = transactions.filter((item) => item.id !== previous.id);
  if (previous.reimbursementForId) {
    nextTransactions = nextTransactions.map((item) => item.id === previous.reimbursementForId
      ? { ...item, reimbursed: false, reimbursementTransactionId: undefined } as TT
      : item);
    const original = nextTransactions.find((item) => item.id === previous.reimbursementForId);
    const claim = original ? nextAccounts.find((account) => account.id === original.reimburseAccountId) : undefined;
    if (original && claim && accountRole(claim.type) === 'receivable') {
      nextAccounts = applyLedger(nextAccounts, { kind: 'income', accountId: claim.id, accountAmount: original.accountAmount }, 1);
    }
  }
  if (previous.reimbursementTransactionId) {
    const credit = transactions.find((item) => item.id === previous.reimbursementTransactionId);
    if (credit) nextAccounts = applyLedger(nextAccounts, credit, -1);
    nextTransactions = nextTransactions.filter((item) => item.id !== previous.reimbursementTransactionId);
  }
  return { accounts: nextAccounts, transactions: nextTransactions };
}
