export type ScheduleColor = 'blue' | 'green' | 'orange';
export type TransactionKind = 'expense' | 'income' | 'transfer';
export type Currency = 'CNY' | 'USD' | 'HKD' | 'EUR' | 'JPY';
export type InvestmentKind = 'fund' | 'stock' | 'crypto' | 'meme';

export type ScheduleItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
  color: ScheduleColor;
  done: boolean;
};

export type Account = { id: string; name: string; type: string; balance: number; currency: Currency; tone: 'forest' | 'clay' | 'ink' };
export type Transaction = { id: string; kind: TransactionKind; amount: number; accountAmount: number; currency: Currency; merchant: string; category: string; accountId: string; targetAccountId?: string; source: string; reimbursable: boolean; createdAt: string };
export type RecurringRule = { id: string; name: string; kind: 'subscription' | 'credit-card'; amount: number; currency: Currency; accountId: string; targetAccountId?: string; dueDay: number; enabled: boolean; lastRunPeriod?: string };
export type HealthRecord = { id: string; kind: 'sleep' | 'meal' | 'exercise'; value: number; note: string; createdAt: string };
export type MemoryItem = { id: string; kind: '目标' | '偏好' | '观察'; title: string; note: string; active: boolean };
export type PrivacySettings = { health: boolean; finance: boolean; schedule: boolean };
export type VaultItem = { id: string; title: string; usernameHint: string; note: string };
export type TravelItem = { id: string; kind: 'train' | 'flight'; number: string; from: string; to: string; departAt: string; arriveAt: string; seat: string; terminal: string; status: 'upcoming' | 'completed' | 'changed'; source: 'manual' | 'calendar' | 'notification' | 'import'; verified: boolean };
export type PricePoint = { date: string; price: number };
export type InvestmentHolding = { id: string; accountId: string; kind: InvestmentKind; name: string; code: string; contract: string; network: string; quantity: number; averageCost: number; currentPrice: number; currency: Currency; updatedAt: string; quoteStatus: 'sample' | 'manual' | 'live'; history: PricePoint[] };
export type AppData = { schedules: ScheduleItem[]; accounts: Account[]; transactions: Transaction[]; recurringRules: RecurringRule[]; healthRecords: HealthRecord[]; travels: TravelItem[]; investments: InvestmentHolding[]; memories: MemoryItem[]; privacy: PrivacySettings; vaultItems: VaultItem[]; theme: 'light' | 'dark' };

export const emptyData: AppData = {
  schedules: [],
  accounts: [],
  transactions: [],
  recurringRules: [],
  healthRecords: [],
  travels: [],
  investments: [],
  memories: [],
  privacy: { health: false, finance: false, schedule: false },
  vaultItems: [],
  theme: 'light',
};

export function investmentValue(item: InvestmentHolding) {
  return item.quantity * item.currentPrice;
}

export function normalizeData(raw: Partial<AppData>): AppData {
  const investments = raw.investments ?? emptyData.investments;
  const accounts = (raw.accounts ?? emptyData.accounts).map((account) => ({
    ...account,
    currency: account.currency ?? 'CNY',
  }));
  return {
    schedules: raw.schedules ?? emptyData.schedules,
    accounts,
    transactions: (raw.transactions ?? emptyData.transactions).map((item) => ({
      ...item,
      currency: item.currency ?? accounts.find((account) => account.id === item.accountId)?.currency ?? 'CNY',
      accountAmount: item.accountAmount ?? item.amount,
      reimbursable: item.reimbursable ?? false,
    })),
    recurringRules: raw.recurringRules ?? emptyData.recurringRules,
    healthRecords: raw.healthRecords ?? emptyData.healthRecords,
    travels: raw.travels ?? emptyData.travels,
    investments,
    memories: raw.memories ?? emptyData.memories,
    privacy: raw.privacy ?? emptyData.privacy,
    vaultItems: raw.vaultItems ?? emptyData.vaultItems,
    theme: raw.theme ?? emptyData.theme,
  };
}
