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

export type LedgerAccount = { id: string; type: string; currency: string; balance: number };
export type LedgerTxn = {
  kind: 'expense' | 'income' | 'transfer';
  accountId: string;
  targetAccountId?: string;
  accountAmount: number;
  reimbursable?: boolean;
  reimburseAccountId?: string;
  reimbursed?: boolean;
};

export function defaultCashId(accounts: LedgerAccount[], currency: string): string | undefined {
  const matches = accounts.filter((account) => accountRole(account.type) === 'asset' && account.currency === currency);
  return (matches.find((account) => /资金|储蓄|现金|支付宝|微信|银行/.test(`${account.type}${account.id}`)) ?? matches[0])?.id;
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
  if (transaction.kind === 'transfer' && account.id === transaction.targetAccountId) {
    return debt ? -amount : amount;
  }
  return 0;
}

export function applyLedger<T extends LedgerAccount>(accounts: T[], transaction: LedgerTxn, factor: 1 | -1): T[] {
  return accounts.map((account) => {
    const delta = ledgerDelta(account, transaction) * factor;
    if (!delta) return account;
    const next = account.balance + delta;
    return { ...account, balance: isDebtRole(accountRole(account.type)) ? Math.max(0, next) : next };
  });
}
