'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { accountRole, addDaysKey, applyDailyFxRates, applyDailyPriceQuotes, applyLedger, buildButlerSystemPrompt, buildHealthBriefing, canApplyLedger, cnyWealthTotal, defaultCashId, describeButlerDataScope, detectLegacyDemoData, healthRecordsFromSnapshots, isBackupPayload, isDebtRole, latestHealthByKind, localDateKey, migrateLegacyReimbursementAccounts, normalizeAccountBalance, normalizeMemory, parseButlerModelOutput, parseNaturalCapture, planAccountSettlement, reconcileRecurringConfirmations, releaseRecurringConfirmation, removeLedgerTransactionState, resolvePaymentAccountId, settleReimbursementState, summarizeHealth, upsertByExternalKey, wealthTotals, weekDates, type ButlerAction, type HealthMetric, type TravelKind } from './product-logic';

type Tab = 'home' | 'schedule' | 'capture' | 'finance' | 'profile' | 'health' | 'travel' | 'data' | 'butler' | 'privacy' | 'memory' | 'vault';
type ScheduleColor = 'blue' | 'green' | 'orange';
type TransactionKind = 'expense' | 'income' | 'transfer';
type Currency = 'CNY' | 'USD' | 'HKD' | 'EUR' | 'JPY';

type ScheduleItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
  color: ScheduleColor;
  done: boolean;
};

type Account = { id: string; name: string; type: string; balance: number; currency: Currency; tone: 'forest' | 'clay' | 'ink' };
type Transaction = { id: string; kind: TransactionKind; amount: number; accountAmount: number; currency: Currency; merchant: string; category: string; accountId: string; targetAccountId?: string; source: string; reimbursable: boolean; reimburseAccountId?: string; reimbursed?: boolean; reimbursementForId?: string; reimbursementTransactionId?: string; recurringRuleId?: string; createdAt: string };
type RecurringRule = { id: string; name: string; kind: 'subscription' | 'credit-card'; amount: number; currency: Currency; accountId: string; targetAccountId?: string; dueDay: number; enabled: boolean; lastRunPeriod?: string };
type HealthRecord = { id: string; kind: 'sleep' | 'meal' | 'exercise' | 'steps' | 'height' | 'weight' | 'heartRate' | 'stress' | 'pai'; value: number; note: string; createdAt: string; externalKey?: string };
type MemoryItem = { id: string; kind: '目标' | '偏好' | '观察'; title: string; note: string; active: boolean; source: string; purpose: string; updatedAt: string };
type PrivacySettings = { health: boolean; finance: boolean; schedule: boolean };
type VaultItem = { id: string; title: string; usernameHint: string; note: string };
type TravelItem = { id: string; kind: 'train' | 'flight'; number: string; from: string; to: string; departAt: string; arriveAt: string; seat: string; terminal: string; status: 'upcoming' | 'completed' | 'changed'; source: 'manual' | 'calendar' | 'notification' | 'import'; verified: boolean };
type InvestmentKind = 'fund' | 'stock' | 'crypto' | 'meme';
type PricePoint = { date: string; price: number };
type InvestmentHolding = { id: string; accountId: string; kind: InvestmentKind; name: string; code: string; contract: string; network: string; quantity: number; averageCost: number; currentPrice: number; currency: Currency; updatedAt: string; quoteStatus: 'sample' | 'manual' | 'live'; history: PricePoint[] };
type ExchangeRate = { currency: Exclude<Currency, 'CNY'>; cnyRate: number; asOf: string; source: 'manual' | 'daily'; updatedAt: string };
type AppData = { schemaVersion: 2; demoMode: boolean; schedules: ScheduleItem[]; accounts: Account[]; transactions: Transaction[]; recurringRules: RecurringRule[]; healthRecords: HealthRecord[]; travels: TravelItem[]; investments: InvestmentHolding[]; exchangeRates: ExchangeRate[]; memories: MemoryItem[]; privacy: PrivacySettings; vaultItems: VaultItem[]; theme: 'light' | 'dark' };
type ExpenseDraft = { kind: 'expense'; amount: number; merchant: string; category: string; accountId: string; source: string; currency: Currency; reimbursable: boolean };
type ScheduleDraft = { kind: 'schedule'; title: string; date: string; time: string };
type TravelDraft = { kind: 'travel'; travelKind: TravelKind; number: string; from: string; to: string; date: string; departTime: string; arriveTime?: string };
type HealthDraft = { kind: 'health'; metric: HealthMetric; value: number };
type CaptureDraft = ExpenseDraft | ScheduleDraft | TravelDraft | HealthDraft;
const HEALTH_METRIC_LABELS: Record<HealthMetric, string> = { steps: '步数', heartRate: '心率', stress: '压力', sleep: '睡眠', pai: 'PAI', height: '身高', weight: '体重' };

const TODAY = localDateKey();
const STORAGE_KEY = 'self-agent:local-data:v1';
const AI_CONFIG_KEY = 'self-agent:ai-config:v1';
type AiConfig = { baseUrl: string; model: string; apiKey: string };
const emptyAi: AiConfig = { baseUrl: '', model: 'gpt-4o-mini', apiKey: '' };
const MONTH = TODAY.slice(0, 7);
const now = new Date();
const TODAY_LABEL = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);
const GREETING = now.getHours() < 5 ? '夜深了，先照顾好休息。' : now.getHours() < 11 ? '早上好，今天慢慢来。' : now.getHours() < 14 ? '中午好，给自己留点余地。' : now.getHours() < 18 ? '下午好，一次做好一件事。' : '晚上好，收好今天再休息。';
const accountTypes = ['资金账户', '储蓄卡', '现金', '信用卡', '理财账户', '储值账户', '订阅账户', '待收回', '欠款', '物品资产'];
const currencies: Currency[] = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'];
function roleLabel(type: string) {
  const role = accountRole(type);
  if (role === 'receivable') return '债务 · 应收';
  if (role === 'payable' || role === 'liability') return '债务 · 应付';
  if (role === 'plan') return '计划扣款';
  return type;
}
function canHoldMoney(account: Account | undefined) {
  return Boolean(account && accountRole(account.type) === 'asset' && !/物品资产|订阅账户/.test(account.type));
}

const demoData: AppData = {
  schemaVersion: 2,
  demoMode: true,
  schedules: [
    { id: 's1', date: TODAY, time: '09:30', title: '项目周会', detail: '线上会议 · 45 分钟', color: 'blue', done: true },
    { id: 's2', date: TODAY, time: '12:20', title: '午饭后散步', detail: '健康 · 20 分钟', color: 'green', done: false },
    { id: 's3', date: TODAY, time: '15:00', title: '整理季度预算', detail: '专注时间 · 60 分钟', color: 'blue', done: false },
    { id: 's4', date: TODAY, time: '19:30', title: '给妈妈打电话', detail: '个人 · 提醒一次', color: 'orange', done: false },
  ],
  accounts: [
    { id: 'wechat', name: '微信余额', type: '资金账户', balance: 1280.55, currency: 'CNY', tone: 'forest' },
    { id: 'alipay', name: '支付宝', type: '资金账户', balance: 830.2, currency: 'CNY', tone: 'ink' },
    { id: 'bank', name: '日常银行卡', type: '储蓄卡', balance: 12600, currency: 'CNY', tone: 'clay' },
    { id: 'credit', name: '信用卡', type: '待还款', balance: -2340, currency: 'CNY', tone: 'ink' },
    { id: 'invest-cny', name: '人民币理财', type: '理财账户', balance: 4150, currency: 'CNY', tone: 'forest' },
    { id: 'invest-usd', name: '海外投资', type: '理财账户', balance: 1131.5, currency: 'USD', tone: 'ink' },
  ],
  transactions: [
    { id: 't1', kind: 'expense', amount: 36, accountAmount: 36, currency: 'CNY', merchant: '午餐', category: '餐饮', accountId: 'wechat', source: '手动记录', reimbursable: true, createdAt: '2026-08-28T12:31:00+08:00' },
    { id: 't2', kind: 'expense', amount: 18.5, accountAmount: 18.5, currency: 'CNY', merchant: '地铁出行', category: '交通', accountId: 'alipay', source: '通知草稿确认', reimbursable: false, createdAt: '2026-08-28T08:42:00+08:00' },
    { id: 't3', kind: 'income', amount: 4200, accountAmount: 4200, currency: 'CNY', merchant: '项目回款', category: '收入', accountId: 'bank', source: '手动记录', reimbursable: false, createdAt: '2026-08-27T16:18:00+08:00' },
    { id: 't4', kind: 'expense', amount: 128, accountAmount: 128, currency: 'CNY', merchant: '超市采购', category: '生活', accountId: 'alipay', source: '手动记录', reimbursable: false, createdAt: '2026-08-20T18:22:00+08:00' },
    { id: 't5', kind: 'expense', amount: 68, accountAmount: 68, currency: 'CNY', merchant: '手机套餐', category: '生活', accountId: 'bank', source: '自动扣款确认', reimbursable: false, createdAt: '2026-08-10T09:00:00+08:00' },
  ],
  recurringRules: [
    { id: 'r1', name: '云盘订阅', kind: 'subscription', amount: 30, currency: 'CNY', accountId: 'alipay', dueDay: 30, enabled: true },
    { id: 'r2', name: '信用卡还款', kind: 'credit-card', amount: 2340, currency: 'CNY', accountId: 'bank', targetAccountId: 'credit', dueDay: 5, enabled: true, lastRunPeriod: MONTH },
  ],
  healthRecords: [
    { id: 'h1', kind: 'sleep', value: 6.2, note: '昨晚睡眠', createdAt: '2026-08-28T07:10:00+08:00' },
    { id: 'h2', kind: 'exercise', value: 32, note: '快走', createdAt: '2026-08-27T19:20:00+08:00' },
    { id: 'h3', kind: 'meal', value: 2, note: '今日已记录餐数', createdAt: '2026-08-28T13:00:00+08:00' },
  ],
  travels: [
    { id: 'travel-1', kind: 'train', number: 'G11', from: '北京南', to: '上海虹桥', departAt: '2026-08-30T09:00:00+08:00', arriveAt: '2026-08-30T13:28:00+08:00', seat: '06车 08A', terminal: '检票口待同步', status: 'upcoming', source: 'import', verified: false },
    { id: 'travel-2', kind: 'flight', number: '示例航班 MU5101', from: '上海虹桥', to: '北京首都', departAt: '2026-09-03T08:20:00+08:00', arriveAt: '2026-09-03T10:40:00+08:00', seat: '座位待值机', terminal: 'T2', status: 'upcoming', source: 'import', verified: false },
  ],
  investments: [
    { id: 'holding-1', accountId: 'invest-cny', kind: 'fund', name: '沪深300ETF（示例）', code: '510300.SH', contract: '', network: '', quantity: 1000, averageCost: 3.82, currentPrice: 4.15, currency: 'CNY', updatedAt: TODAY, quoteStatus: 'sample', history: [{ date: '08-22', price: 4.02 }, { date: '08-23', price: 4.08 }, { date: '08-24', price: 4.05 }, { date: '08-25', price: 4.11 }, { date: '08-26', price: 4.09 }, { date: '08-27', price: 4.13 }, { date: '08-28', price: 4.15 }] },
    { id: 'holding-2', accountId: 'invest-usd', kind: 'stock', name: 'Apple（示例）', code: 'AAPL', contract: '', network: '', quantity: 5, averageCost: 186, currentPrice: 224.5, currency: 'USD', updatedAt: TODAY, quoteStatus: 'sample', history: [{ date: '08-22', price: 216 }, { date: '08-23', price: 219 }, { date: '08-24', price: 217.5 }, { date: '08-25', price: 221 }, { date: '08-26', price: 220.4 }, { date: '08-27', price: 222 }, { date: '08-28', price: 224.5 }] },
    { id: 'holding-3', accountId: 'invest-usd', kind: 'meme', name: 'PEPE（示例）', code: 'PEPE', contract: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', network: 'Ethereum', quantity: 1000000, averageCost: 0.0000082, currentPrice: 0.000009, currency: 'USD', updatedAt: TODAY, quoteStatus: 'sample', history: [{ date: '08-22', price: 0.0000081 }, { date: '08-23', price: 0.0000084 }, { date: '08-24', price: 0.0000083 }, { date: '08-25', price: 0.0000087 }, { date: '08-26', price: 0.0000085 }, { date: '08-27', price: 0.0000088 }, { date: '08-28', price: 0.000009 }] },
  ],
  exchangeRates: [],
  memories: [
    { id: 'm1', kind: '目标', title: '每月结余至少 2,000 元', note: '用于生成财务提醒，不自动修改账户。', active: true, source: '演示数据', purpose: '用于生成财务提醒，不自动修改账户。', updatedAt: TODAY },
    { id: 'm2', kind: '偏好', title: '23:30 前开始睡前准备', note: '提醒保持温和，不因一次未完成而批评。', active: true, source: '演示数据', purpose: '用于提醒语气与作息建议', updatedAt: TODAY },
    { id: 'm3', kind: '观察', title: '睡眠不足后外卖支出可能上升', note: '只是相关性观察，7 天后复核。', active: false, source: '演示数据', purpose: '用于观察复核，不自动下诊断', updatedAt: TODAY },
  ],
  privacy: { health: true, finance: true, schedule: true },
  vaultItems: [
    { id: 'v1', title: '招商银行', usernameHint: '账号已保存', note: '等待 Android Autofill 接管' },
    { id: 'v2', title: '个人邮箱', usernameHint: '账号已保存', note: '不在网页保存密码明文' },
  ],
  theme: 'light',
};

const emptyData: AppData = {
  schemaVersion: 2,
  demoMode: false,
  schedules: [],
  accounts: [],
  transactions: [],
  recurringRules: [],
  healthRecords: [],
  travels: [],
  investments: [],
  exchangeRates: [],
  memories: [],
  privacy: { health: false, finance: false, schedule: false },
  vaultItems: [],
  theme: 'light',
};

const navItems: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '首页', icon: '⌂' }, { id: 'schedule', label: '日程', icon: '□' },
  { id: 'capture', label: '记录', icon: '＋' }, { id: 'finance', label: '财务', icon: '▣' },
  { id: 'profile', label: '我的', icon: '○' },
];

function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function currencyMark(currency: Currency) { return currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : currency === 'EUR' ? '€' : 'JP¥'; }
function formatAssetAmount(currency: string, amount: number) {
  return `${amount < 0 ? '−' : ''}${currencyMark(currency as Currency)} ${money(Math.abs(amount))}`;
}
function formatCnyWealthSummary(accounts: { type: string; currency: string; balance: number }[], transactions: { kind: string; currency?: string; amount?: number; accountAmount?: number; reimbursable?: boolean; reimbursed?: boolean }[] = [], rates: ExchangeRate[] = []) {
  const total = cnyWealthTotal(accounts, transactions, rates);
  return total.unresolved.length ? `¥ ${money(total.convertedCny)}（待折算 ${total.unresolved.map((item) => `${item.currency} ${money(item.amount)}`).join(' · ')}）` : `¥ ${money(total.convertedCny)}`;
}
function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function localStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function investmentValue(item: InvestmentHolding) { return item.quantity * item.currentPrice; }
function investmentProfit(item: InvestmentHolding) { return investmentValue(item) - item.quantity * item.averageCost; }
function syncInvestmentBalances(accounts: Account[], investments: InvestmentHolding[]) {
  const totals = new Map<string, number>();
  investments.forEach((item) => totals.set(item.accountId, (totals.get(item.accountId) ?? 0) + investmentValue(item)));
  return accounts.map((account) => totals.has(account.id) ? { ...account, balance: totals.get(account.id) ?? account.balance } : account);
}
function normalizeData(raw: Partial<AppData>): AppData {
  const investments = raw.investments ?? [];
  const rawAccounts = (raw.accounts ?? []).map((account) => ({ ...account, currency: account.currency ?? 'CNY' as Currency, balance: normalizeAccountBalance(account.type, account.balance) }));
  const rawTransactions = (raw.transactions ?? []).map((item) => ({
    ...item,
    currency: item.currency ?? rawAccounts.find((account) => account.id === item.accountId)?.currency ?? 'CNY',
    accountAmount: item.accountAmount ?? item.amount,
    reimbursable: item.reimbursable ?? false,
    reimbursed: item.reimbursed ?? false,
  }));
  const migrated = migrateLegacyReimbursementAccounts(rawAccounts, rawTransactions);
  const accounts = syncInvestmentBalances(migrated.accounts, investments);
  return {
    schemaVersion: 2,
    demoMode: raw.demoMode ?? detectLegacyDemoData(raw),
    schedules: raw.schedules ?? [],
    accounts,
    transactions: migrated.transactions.map((item) => ({
      ...item,
      currency: item.currency ?? accounts.find((account) => account.id === item.accountId)?.currency ?? 'CNY',
      accountAmount: item.accountAmount ?? item.amount,
      reimbursable: item.reimbursable ?? false,
      reimbursed: item.reimbursed ?? false,
      reimburseAccountId: (() => {
        const dest = accounts.find((account) => account.id === item.reimburseAccountId);
        if (dest && accountRole(dest.type) === 'receivable') return undefined;
        return item.reimburseAccountId;
      })(),
    })),
    recurringRules: reconcileRecurringConfirmations(raw.recurringRules ?? [], migrated.transactions),
    healthRecords: raw.healthRecords ?? [],
    travels: raw.travels ?? [],
    investments,
    exchangeRates: (raw.exchangeRates ?? []).filter((rate): rate is ExchangeRate => Boolean(rate && rate.currency !== 'CNY' && currencies.includes(rate.currency as Currency) && Number.isFinite(rate.cnyRate) && rate.cnyRate > 0 && typeof rate.asOf === 'string' && typeof rate.updatedAt === 'string')).map((rate) => ({ ...rate, source: rate.source === 'daily' ? 'daily' : 'manual' })),
    memories: (raw.memories ?? []).map((item) => {
      const memory = normalizeMemory(item);
      const kind: MemoryItem['kind'] = memory.kind === '目标' || memory.kind === '偏好' ? memory.kind : '观察';
      return { ...memory, kind };
    }),
    privacy: { ...emptyData.privacy, ...(raw.privacy ?? {}) },
    vaultItems: raw.vaultItems ?? [],
    theme: raw.theme ?? 'light',
  };
}
function adjustAccounts(accounts: Account[], transaction: Transaction, factor: 1 | -1) {
  return applyLedger(accounts, transaction, factor);
}
function parseCapture(text: string, accounts: Account[]): CaptureDraft {
  const parsed = parseNaturalCapture(text, TODAY);
  if (parsed.kind === 'schedule' || parsed.kind === 'travel' || parsed.kind === 'health') return parsed;
  const preferredId = parsed.source === '支付宝' ? 'alipay' : parsed.source === '银行卡' ? 'bank' : 'wechat';
  const account = accounts.find((item) => item.id === preferredId) ?? accounts.find((item) => item.name.includes(parsed.source)) ?? accounts[0];
  return {
    kind: 'expense',
    amount: parsed.amount,
    merchant: parsed.merchant,
    category: parsed.category,
    accountId: account?.id ?? '',
    source: `一句话记录 · ${parsed.source}`,
    currency: account?.currency ?? 'CNY',
    reimbursable: false,
  };
}

export default function Home() {
  const [data, setData] = useState<AppData>(emptyData);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTabState] = useState<Tab>('home');
  const [history, setHistory] = useState<Tab[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig>(emptyAi);
  const [nativeOn, setNativeOn] = useState(false);
  const [caps, setCaps] = useState({ accessibility: false, notifications: false, notificationListener: false, autofill: false });
  const [vaultMeta, setVaultMeta] = useState<{ title: string; usernameHint: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [sheet, setSheet] = useState<'schedule' | 'transaction' | 'account' | 'recurring' | 'exchange-rate' | 'health' | 'travel' | 'holding' | 'settle-account' | null>(null);
  const [financeCurrency, setFinanceCurrency] = useState<Currency>('CNY');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editingRateCurrency, setEditingRateCurrency] = useState<Exclude<Currency, 'CNY'> | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [settlingAccountId, setSettlingAccountId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [captureText, setCaptureText] = useState('');
  const [draft, setDraft] = useState<CaptureDraft | null>(null);

  function navigate(next: Tab) {
    setTabState((current) => {
      if (current !== next) setHistory((stack) => [...stack, current]);
      return next;
    });
  }
  function goBack() {
    if (sheet) { setSheet(null); setEditingScheduleId(null); setEditingTransactionId(null); setEditingRecurringId(null); return true; }
    if (tab === 'finance' && selectedHoldingId) { setSelectedHoldingId(null); return true; }
    if (tab === 'finance' && selectedAccountId) { setSelectedAccountId(null); return true; }
    if (history.length) {
      const prev = history[history.length - 1];
      setHistory((stack) => stack.slice(0, -1));
      setTabState(prev);
      return true;
    }
    if (tab !== 'home') { setTabState('home'); return true; }
    return false;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) setData(normalizeData(JSON.parse(saved) as Partial<AppData>));
        const ai = window.localStorage.getItem(AI_CONFIG_KEY); if (ai) setAiConfig({ ...emptyAi, ...(JSON.parse(ai) as Partial<AiConfig>) });
      }
      catch { /* Corrupt local data should not prevent the app from opening. */ }
      finally { setHydrated(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    function onTravel(event: Event) {
      const items = (event as CustomEvent<TravelItem[]>).detail;
      if (!Array.isArray(items) || !items.length) return;
      setData((current) => {
        const next = [...current.travels];
        for (const item of items) {
          const key = `${item.kind}-${item.number}-${String(item.departAt).slice(0, 10)}`;
          const index = next.findIndex((row) => `${row.kind}-${row.number}-${row.departAt.slice(0, 10)}` === key);
          const merged = { ...item, id: item.id || uid('travel'), verified: true, source: item.source || 'notification' };
          if (index >= 0) next[index] = { ...next[index], ...merged };
          else next.push(merged);
        }
        return { ...current, travels: next.sort((a, b) => a.departAt.localeCompare(b.departAt)) };
      });
      notify('已从通知导入火车/航班');
    }
    function onHealth(event: Event) {
      const detail = (event as CustomEvent<{ records?: Parameters<typeof healthRecordsFromSnapshots>[0]; source?: string }>).detail || {};
      const snapshots = Array.isArray(detail.records) ? detail.records : [detail];
      const mapped = healthRecordsFromSnapshots(snapshots, detail.source || 'health-connect')
        .map((item) => ({ ...item, id: uid('health'), kind: item.kind as HealthRecord['kind'], note: item.note || item.kind, createdAt: item.createdAt || TODAY }));
      if (!mapped.length) { notify('健康平台暂无近几日数据'); return; }
      setData((current) => ({ ...current, healthRecords: upsertByExternalKey(current.healthRecords, mapped) }));
      notify('已导入身高体重心率睡眠等健康摘要');
    }
    window.addEventListener('self-agent:travel-updated', onTravel);
    window.addEventListener('self-agent:health-import', onHealth);
    return () => { window.removeEventListener('self-agent:travel-updated', onTravel); window.removeEventListener('self-agent:health-import', onHealth); };
  }, []);
  useEffect(() => {
    const w = window as Window & { selfAgentHandleBack?: () => boolean };
    w.selfAgentHandleBack = () => goBack();
    return () => { delete w.selfAgentHandleBack; };
  });
  useEffect(() => {
    const w = window as Window & { SelfAgentNative?: { nativeReady?: () => boolean; vaultMeta?: () => string; capabilityStatus?: () => string } };
    function refreshNative() {
      try {
        if (!w.SelfAgentNative?.nativeReady?.()) return;
        setNativeOn(true);
        const meta = JSON.parse(w.SelfAgentNative.vaultMeta?.() || '[]') as { title: string; usernameHint: string }[];
        if (Array.isArray(meta)) setVaultMeta(meta);
        const status = JSON.parse(w.SelfAgentNative.capabilityStatus?.() || '{}') as Partial<typeof caps>;
        setCaps({
          accessibility: Boolean(status.accessibility),
          notifications: Boolean(status.notifications),
          notificationListener: Boolean(status.notificationListener),
          autofill: Boolean(status.autofill),
        });
      } catch { /* Native bridge is optional on web. */ }
    }
    refreshNative();
    document.addEventListener('visibilitychange', refreshNative);
    const timer = window.setInterval(refreshNative, 4000);
    return () => { document.removeEventListener('visibilitychange', refreshNative); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    const refreshClock = () => { if (localDateKey() !== TODAY) window.location.reload(); };
    document.addEventListener('visibilitychange', refreshClock);
    const timer = window.setInterval(refreshClock, 60_000);
    return () => { document.removeEventListener('visibilitychange', refreshClock); window.clearInterval(timer); };
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, hydrated]);
  useEffect(() => {
    if (!hydrated || !nativeOn) return;
    const native = window as Window & { SelfAgentNative?: { syncReminders?: (json: string) => void } };
    native.SelfAgentNative?.syncReminders?.(JSON.stringify({
      schedules: data.schedules.filter((item) => !item.done).map((item) => ({ id: item.id, title: item.title, date: item.date, time: item.time })),
      bills: data.recurringRules.filter((item) => item.enabled).map((item) => ({ id: item.id, name: item.name, dueDay: item.dueDay, amount: item.amount, lastRunPeriod: item.lastRunPeriod || '' })),
      month: MONTH,
    }));
  }, [data.schedules, data.recurringRules, hydrated, nativeOn]);
  useEffect(() => {
    if (!hydrated || !nativeOn) return;
    const native = window as Window & { SelfAgentNative?: { syncQuotes?: (json: string) => void } };
    const currencies = [...new Set(data.accounts.map((item) => item.currency).concat(data.investments.map((item) => item.currency)).filter((item) => item !== 'CNY'))];
    native.SelfAgentNative?.syncQuotes?.(JSON.stringify({
      hour: 18,
      currencies,
      holdings: data.investments.filter((item) => item.code).map((item) => ({ id: item.id, code: item.code, kind: item.kind })),
    }));
  }, [data.accounts, data.investments, hydrated, nativeOn]);
  useEffect(() => {
    function onQuotes(event: Event) {
      const detail = (event as CustomEvent<{ rates?: ExchangeRate[]; quotes?: { holdingId: string; price: number; asOf: string; source: string }[] }>).detail || {};
      setData((current) => {
        const investments = applyDailyPriceQuotes(current.investments, detail.quotes ?? []);
        return { ...current, exchangeRates: applyDailyFxRates(current.exchangeRates, (detail.rates ?? []).map((rate) => ({ ...rate, source: 'daily' }))), investments, accounts: syncInvestmentBalances(current.accounts, investments) };
      });
      notify('已按今日参考价更新估值，账本流水未改动');
    }
    window.addEventListener('self-agent:quotes-updated', onQuotes);
    return () => window.removeEventListener('self-agent:quotes-updated', onQuotes);
  }, []);
  useEffect(() => {
    function onCaptureText(event: Event) {
      const text = String((event as CustomEvent<{ text?: string }>).detail?.text || '').trim();
      if (!text) { notify('没有识别到文字，请重试或手动输入'); return; }
      setCaptureText((current) => `${current}${current ? ' ' : ''}${text}`.slice(0, 400));
      navigate('capture');
      notify('已写入快速记录');
    }
    window.addEventListener('self-agent:capture-text', onCaptureText);
    return () => window.removeEventListener('self-agent:capture-text', onCaptureText);
  }, []);
  useEffect(() => {
    function onPayment(event: Event) {
      const detail = (event as CustomEvent<Partial<ExpenseDraft> & { title?: string; dir?: string; source?: string; accountHint?: string }>).detail;
      const merchant = detail.merchant || detail.title || '支付成功';
      const accountId = resolvePaymentAccountId(data.accounts, detail.source, detail.accountHint) ?? '';
      setDraft({ kind: 'expense', amount: Number(detail.amount ?? 0), merchant, category: detail.category || '其他', accountId, source: String(detail.source || 'Android 支付通知'), currency: detail.currency || 'CNY', reimbursable: false });
      setCaptureText('检测到一笔支付，请确认后保存'); navigate('capture');
    }
    function onAutoTxn(event: Event) {
      const detail = (event as CustomEvent<{ id?: string; amount?: number | null; title?: string; category?: string; source?: string; accountHint?: string; dir?: string; autoSave?: boolean }>).detail || {};
      if (detail.autoSave) {
        const kind = detail.dir === 'in' ? 'income' : 'expense';
        const amount = Math.abs(Number(detail.amount ?? 0));
        const merchant = detail.title || '支付成功';
        const accountId = resolvePaymentAccountId(data.accounts, detail.source, detail.accountHint);
        if (!accountId || !Number.isFinite(amount) || amount <= 0) {
          onPayment(new CustomEvent('x', { detail: { amount: Number.isFinite(amount) ? amount : 0, merchant, category: detail.category, source: detail.source, accountHint: detail.accountHint } }));
          return;
        }
        const fingerprint = String(detail.id || `${detail.source}-${amount}-${merchant}`);
        const transaction: Transaction = { id: fingerprint.startsWith('transaction-') ? fingerprint : `txn-${fingerprint}`, kind, amount, accountAmount: amount, currency: 'CNY', merchant, category: detail.category || (kind === 'income' ? '收入' : '其他'), accountId, source: String(detail.source || 'Android 自动记账'), reimbursable: false, createdAt: localStamp() };
        if (!canApplyLedger(data.accounts, transaction)) {
          onPayment(new CustomEvent('x', { detail: { amount, merchant, category: detail.category, source: detail.source, accountHint: detail.accountHint } }));
          return;
        }
        setData((current) => {
          if (current.transactions.some((item) => item.id === transaction.id || (item.merchant === merchant && item.amount === amount && Math.abs(Date.parse(item.createdAt) - Date.now()) < 180000))) return current;
          return { ...current, transactions: [transaction, ...current.transactions], accounts: adjustAccounts(current.accounts, transaction, 1) };
        });
        notify('已从通知确认入账');
        return;
      }
      onPayment(new CustomEvent('x', { detail: { amount: detail.amount ?? 0, merchant: detail.title, category: detail.category, source: detail.source, accountHint: detail.accountHint } }));
    }
    window.addEventListener('self-agent:payment-detected', onPayment);
    window.addEventListener('self-agent:auto-txn', onAutoTxn);
    (window as Window & { onAutoTxn?: (p: unknown) => void }).onAutoTxn = (p) => onAutoTxn(new CustomEvent('self-agent:auto-txn', { detail: p }));
    return () => {
      window.removeEventListener('self-agent:payment-detected', onPayment);
      window.removeEventListener('self-agent:auto-txn', onAutoTxn);
    };
  }, [data.accounts]);

  const dateOptions = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const weekTitle = useMemo(() => {
    const first = dateOptions[0].value;
    const last = dateOptions[6].value;
    const firstLabel = `${Number(first.slice(0, 4))}年${Number(first.slice(5, 7))}月${Number(first.slice(8, 10))}日`;
    const lastLabel = first.slice(0, 7) === last.slice(0, 7) ? `${Number(last.slice(8, 10))}日` : `${Number(last.slice(5, 7))}月${Number(last.slice(8, 10))}日`;
    return `${firstLabel} — ${lastLabel}`;
  }, [dateOptions]);
  const selectedSchedules = useMemo(() => data.schedules.filter((item) => item.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)), [data.schedules, selectedDate]);
  const editingSchedule = editingScheduleId ? data.schedules.find((item) => item.id === editingScheduleId) : undefined;
  const todaySpend = useMemo(() => data.transactions.filter((item) => item.kind === 'expense' && item.currency === 'CNY' && item.createdAt.startsWith(TODAY)).reduce((sum, item) => sum + item.amount, 0), [data.transactions]);
  const totalBalanceLabel = useMemo(() => formatCnyWealthSummary(data.accounts, data.transactions, data.exchangeRates), [data.accounts, data.transactions, data.exchangeRates]);
  const hasBusinessData = data.schedules.length + data.accounts.length + data.transactions.length + data.healthRecords.length + data.travels.length > 0;
  const nextSchedule = useMemo(() => data.schedules.filter((item) => item.date === TODAY && !item.done).sort((left, right) => left.time.localeCompare(right.time))[0], [data.schedules]);
  const editingAccount = editingAccountId ? data.accounts.find((item) => item.id === editingAccountId) : undefined;
  const editingTransaction = editingTransactionId ? data.transactions.find((item) => item.id === editingTransactionId) : undefined;
  const editingHolding = editingHoldingId ? data.investments.find((item) => item.id === editingHoldingId) : undefined;
  const editingRecurring = editingRecurringId ? data.recurringRules.find((item) => item.id === editingRecurringId) : undefined;
  const settlingAccount = settlingAccountId ? data.accounts.find((item) => item.id === settlingAccountId) : undefined;

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2200); }
  function toggleSchedule(id: string) { setData((current) => ({ ...current, schedules: current.schedules.map((item) => item.id === id ? { ...item, done: !item.done } : item) })); }
  function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const editing = editingScheduleId;
    const item: ScheduleItem = { id: editing ?? uid('schedule'), title: String(form.get('title')), date: String(form.get('date')), time: String(form.get('time')), detail: `${String(form.get('detail') || '个人')} · 提前 10 分钟提醒`, color: 'orange', done: false };
    if (!item.date || !item.time) { notify('请填写日期和时间'); return; }
    const nextSchedules = editing ? data.schedules.map((row) => row.id === editing ? { ...item, done: row.done, color: row.color } : row) : [...data.schedules, item];
    setData((current) => ({ ...current, schedules: nextSchedules }));
    setSelectedDate(item.date); setEditingScheduleId(null); setSheet(null);
    pushReminders(nextSchedules, data.recurringRules);
  }
  function pushReminders(schedules: ScheduleItem[], bills: RecurringRule[]) {
    const native = (window as Window & { SelfAgentNative?: { syncReminders?: (json: string) => string } }).SelfAgentNative;
    if (!native?.syncReminders) { notify('系统弹窗只在 Android App 里有效'); return; }
    try {
      const info = JSON.parse(native.syncReminders(JSON.stringify({
        ack: true,
        schedules: schedules.filter((item) => !item.done).map((item) => ({ id: item.id, title: item.title, date: item.date, time: item.time })),
        bills: bills.filter((item) => item.enabled).map((item) => ({ id: item.id, name: item.name, dueDay: item.dueDay, amount: item.amount, lastRunPeriod: item.lastRunPeriod || '' })),
      })) || '{}') as { scheduled?: number; notifications?: boolean };
      if (info.notifications === false) notify('请允许通知并打开横幅，否则不会弹窗');
      else if (!info.scheduled) notify('这个时间已过，没有排上提醒。请选几分钟之后');
      else notify(`已设置 ${info.scheduled} 个提醒（提前10分钟 + 到点）`);
    } catch {
      notify('提醒没有设置成功');
    }
  }
  function deleteSchedule(id: string) {
    setData((current) => ({ ...current, schedules: current.schedules.filter((item) => item.id !== id) }));
    setEditingScheduleId(null); setSheet(null); notify('日程已删除');
  }
  function saveTransaction(input: ExpenseDraft & { transactionKind?: 'expense' | 'income'; accountAmount?: number }) {
    const transactionKind = input.transactionKind ?? 'expense';
    const reimbursable = transactionKind === 'expense' && input.reimbursable;
    const claimId = reimbursable ? data.accounts.find((account) => accountRole(account.type) === 'receivable' && account.currency === input.currency)?.id : undefined;
    const transaction: Transaction = { id: uid('transaction'), kind: transactionKind, amount: Math.abs(input.amount), accountAmount: Math.abs(input.accountAmount ?? input.amount), currency: input.currency, merchant: input.merchant, category: transactionKind === 'income' ? '收入' : input.category, accountId: input.accountId, source: input.source, reimbursable, reimburseAccountId: claimId, reimbursed: false, createdAt: localStamp() };
    setData((current) => ({ ...current, transactions: [transaction, ...current.transactions], accounts: adjustAccounts(current.accounts, transaction, 1) }));
  }
  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const kind = String(form.get('kind')) as TransactionKind;
    const previous = editingTransactionId ? data.transactions.find((item) => item.id === editingTransactionId) : undefined;
    const reimbursable = kind === 'expense' && form.get('reimbursable') === 'on';
    const paidFrom = String(form.get('accountId'));
    const targetId = kind === 'transfer' ? String(form.get('targetAccountId')) : undefined;
    const reimburseTo = String(form.get('reimburseToAccountId') || '');
    const depositTo = String(form.get('reimburseDepositAccountId') || paidFrom);
    const sourceAccount = data.accounts.find((account) => account.id === paidFrom);
    const targetAccount = targetId ? data.accounts.find((account) => account.id === targetId) : undefined;
    const reimburseAccount = data.accounts.find((account) => account.id === reimburseTo);
    const depositAccount = data.accounts.find((account) => account.id === depositTo);
    if (!Number.isFinite(amount) || amount <= 0) { notify('请输入大于 0 的金额'); return; }
    if (!canHoldMoney(sourceAccount) && accountRole(sourceAccount?.type ?? '') !== 'payable') { notify('请选择真实的资金或信用卡账户'); return; }
    if (kind === 'transfer' && (!targetAccount || targetId === paidFrom)) { notify('请选择不同的转入账户'); return; }
    if (kind === 'transfer' && targetAccount && sourceAccount?.currency !== targetAccount.currency) { notify('暂不支持跨币种转账，请选择同币种账户'); return; }
    if (reimbursable && accountRole(reimburseAccount?.type ?? '') !== 'receivable') { notify('报销请记入「待收回」账户，垫付时这里会增加应收'); return; }
    if (reimbursable && reimburseAccount?.currency !== sourceAccount?.currency) { notify('待收回账户必须和支出账户同币种'); return; }
    if (reimbursable && (!canHoldMoney(depositAccount) || depositAccount?.currency !== sourceAccount?.currency)) { notify('报销后打入账户必须是同币种资金账户'); return; }
    const wasSettled = Boolean(previous?.reimbursementTransactionId);
    const transaction: Transaction = { id: previous?.id ?? uid('transaction'), kind, amount: Math.abs(amount), accountAmount: Math.abs(amount * Number(form.get('exchangeRate') || 1)), currency: String(form.get('currency')) as Currency, merchant: String(form.get('merchant')), category: kind === 'income' ? '收入' : kind === 'transfer' ? '账户转账' : String(form.get('category')), accountId: paidFrom, targetAccountId: kind === 'transfer' ? targetId : reimbursable ? depositTo : undefined, source: previous?.source ?? '手动记录', reimbursable, reimburseAccountId: reimbursable ? reimburseTo : undefined, reimbursed: reimbursable ? (wasSettled ? false : previous?.reimbursed ?? false) : false, createdAt: previous?.createdAt ?? localStamp() };
    const baseline = previous ? removeLedgerTransactionState(data.accounts, data.transactions, previous.id) : { accounts: data.accounts, transactions: data.transactions };
    if (!canApplyLedger(baseline.accounts, transaction)) { notify('还款金额不能超过当前欠款；请拆分或修改金额'); return; }
    setData((current) => {
      const removed = previous ? removeLedgerTransactionState(current.accounts, current.transactions, previous.id) : { accounts: current.accounts, transactions: current.transactions };
      return { ...current, accounts: applyLedger(removed.accounts, transaction, 1), transactions: [transaction, ...removed.transactions] };
    });
    setEditingTransactionId(null); setSheet(null); notify(previous ? (wasSettled ? '账目已更新，原报销到账已撤销，请重新入账' : reimbursable ? '微信等支出账户已减少，待收回已增加' : '账目和账户余额已更新') : reimbursable ? '支出已记，待收回应收已增加；到账后再点入账' : '流水已确认入账');
  }
  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const tones: Account['tone'][] = ['forest', 'clay', 'ink'];
    const previous = editingAccountId ? data.accounts.find((item) => item.id === editingAccountId) : undefined;
    const currency = String(form.get('currency')) as Currency;
    if (previous && data.investments.some((item) => item.accountId === previous.id && item.currency !== currency)) { notify('请先调整该账户内持仓币种'); return; }
    const account: Account = { id: previous?.id ?? uid('account'), name: String(form.get('name')), type: String(form.get('type')), balance: normalizeAccountBalance(String(form.get('type')), Number(form.get('balance') || 0)), currency, tone: previous?.tone ?? tones[data.accounts.length % tones.length] };
    setData((current) => ({ ...current, accounts: previous ? current.accounts.map((item) => item.id === previous.id ? account : item) : [...current.accounts, account] })); setEditingAccountId(null); setSheet(null); setFinanceCurrency(account.currency); notify(previous ? '账户资料和余额已更新' : '账户已添加');
  }
  function addExchangeRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const currency = String(form.get('currency')) as Exclude<Currency, 'CNY'>;
    const cnyRate = Number(form.get('cnyRate'));
    const asOf = String(form.get('asOf'));
    if (!currencies.includes(currency) || currency === 'CNY' || !Number.isFinite(cnyRate) || cnyRate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { notify('请填写有效的非人民币汇率和适用日期'); return; }
    const rate: ExchangeRate = { currency, cnyRate, asOf, source: 'manual', updatedAt: localStamp() };
    setData((current) => ({ ...current, exchangeRates: [...current.exchangeRates.filter((item) => item.currency !== currency), rate] }));
    setEditingRateCurrency(null); setSheet(null); notify(`${currency} 汇率已手动保存`);
  }
  function deleteExchangeRate(currency: Exclude<Currency, 'CNY'>) {
    setData((current) => ({ ...current, exchangeRates: current.exchangeRates.filter((item) => item.currency !== currency) }));
    notify(`${currency} 汇率已删除，该币种将不计入人民币总额`);
  }
  function deleteTransaction(id?: string) {
    const previous = data.transactions.find((item) => item.id === (id ?? editingTransactionId));
    if (!previous || !window.confirm('确定删除这笔账目吗？对应账户余额会自动恢复。')) return;
    setData((current) => {
      const removed = removeLedgerTransactionState(current.accounts, current.transactions, previous.id);
      return {
        ...current,
        accounts: removed.accounts,
        transactions: removed.transactions,
        recurringRules: releaseRecurringConfirmation(current.recurringRules, removed.transactions, previous),
      };
    });
    setEditingTransactionId(null); setSheet(null); notify('账目已删除，余额已恢复');
  }
  function settleReimbursement(id: string) {
    const previous = data.transactions.find((item) => item.id === id);
    if (!previous?.reimbursable || previous.reimbursed) { notify('这笔不是待报销，或已经入账'); return; }
    const destId = canHoldMoney(data.accounts.find((account) => account.id === previous.targetAccountId))
      ? previous.targetAccountId
      : canHoldMoney(data.accounts.find((account) => account.id === previous.reimburseAccountId))
        ? previous.reimburseAccountId
        : defaultCashId(data.accounts, previous.currency);
    const destination = data.accounts.find((account) => account.id === destId);
    if (!canHoldMoney(destination) || destination.currency !== data.accounts.find((account) => account.id === previous.accountId)?.currency) { notify('请指定同币种资金账户作为报销到账账户'); return; }
    const credit: Transaction = { id: uid('transaction'), kind: 'income', amount: previous.amount, accountAmount: previous.accountAmount, currency: destination.currency, merchant: `报销入账 · ${previous.merchant}`, category: '报销入账', accountId: destId, source: '报销确认', reimbursable: false, reimbursed: false, createdAt: localStamp() };
    setData((current) => {
      const settled = settleReimbursementState(current.accounts, current.transactions, previous.id, credit);
      return { ...current, accounts: settled.accounts, transactions: settled.transactions };
    });
    notify('报销已打入指定账户');
  }
  function settleAccount(id: string) {
    const account = data.accounts.find((item) => item.id === id);
    if (!account || account.balance <= 0) { notify('没有可结算的余额'); return; }
    const role = accountRole(account.type);
    if (role !== 'receivable' && !isDebtRole(role)) { notify('这个账户不需要收回或还款'); return; }
    setSettlingAccountId(id);
    setSheet('settle-account');
  }
  function confirmAccountSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const account = settlingAccountId ? data.accounts.find((item) => item.id === settlingAccountId) : undefined;
    if (!account) { notify('请先选择账户'); return; }
    const amount = Number(form.get('amount'));
    const counterpartId = String(form.get('counterpartId'));
    const plan = planAccountSettlement(data.accounts, account.id, counterpartId, amount);
    if (!plan.ok) { notify(plan.reason); return; }
    const role = accountRole(account.type);
    const counterpart = data.accounts.find((item) => item.id === counterpartId);
    const transaction: Transaction = {
      id: uid('transaction'),
      kind: 'transfer',
      amount,
      accountAmount: amount,
      currency: account.currency,
      merchant: role === 'receivable' ? `收回 ${account.name}` : `偿还 ${account.name}`,
      category: role === 'receivable' ? '收回应收' : '还款',
      accountId: plan.transaction.accountId,
      targetAccountId: plan.transaction.targetAccountId,
      source: role === 'receivable' ? '应收结算' : '债务还款',
      reimbursable: false,
      reimbursed: false,
      createdAt: localStamp(),
    };
    setData((current) => ({ ...current, accounts: applyLedger(current.accounts, transaction, 1), transactions: [transaction, ...current.transactions] }));
    setSettlingAccountId(null);
    setSheet(null);
    notify(role === 'receivable' ? `已收回 ${money(amount)} 到 ${counterpart?.name ?? '资金账户'}` : `已用 ${counterpart?.name ?? '资金账户'} 还 ${money(amount)}`);
  }
  function addRecurringRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const kind = String(form.get('ruleKind')) as RecurringRule['kind'];
    const currency = String(form.get('currency')) as Currency;
    const accountId = String(form.get('accountId'));
    const targetAccountId = kind === 'credit-card' ? String(form.get('targetAccountId')) : undefined;
    const source = data.accounts.find((account) => account.id === accountId);
    const target = targetAccountId ? data.accounts.find((account) => account.id === targetAccountId) : undefined;
    if (!source || source.currency !== currency || (targetAccountId && target?.currency !== currency)) { notify('账单币种需与相关账户币种一致'); return; }
    if (kind === 'credit-card' && (!canHoldMoney(source) || !target || !isDebtRole(accountRole(target.type)) || target.id === source.id)) { notify('信用卡还款需选择资金账户和不同的债务账户'); return; }
    const previous = editingRecurringId ? data.recurringRules.find((item) => item.id === editingRecurringId) : undefined;
    const rule: RecurringRule = { id: previous?.id ?? uid('rule'), name: String(form.get('name')), kind, amount: Number(form.get('amount')), currency, accountId, targetAccountId, dueDay: Number(form.get('dueDay')), enabled: previous?.enabled ?? true, lastRunPeriod: previous?.lastRunPeriod };
    setData((current) => ({ ...current, recurringRules: previous ? current.recurringRules.map((item) => item.id === previous.id ? rule : item) : [...current.recurringRules, rule] }));
    setEditingRecurringId(null); setSheet(null); notify(previous ? '每月账单已更新' : '每月账单已添加，到期只提醒不代扣');
  }
  function deleteRecurringRule(id?: string) {
    const previous = data.recurringRules.find((item) => item.id === (id ?? editingRecurringId));
    if (!previous || !window.confirm('确定删除这条每月账单吗？已经入账的流水不会自动撤销。')) return;
    setData((current) => ({ ...current, recurringRules: current.recurringRules.filter((item) => item.id !== previous.id) }));
    setEditingRecurringId(null); setSheet(null); notify('每月账单已删除');
  }
  function toggleRecurringRule(id: string) { setData((current) => ({ ...current, recurringRules: current.recurringRules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule) })); }
  function runRecurringRule(id: string) {
    const selected = data.recurringRules.find((rule) => rule.id === id);
    if (!selected || !selected.enabled || selected.lastRunPeriod === MONTH) { notify('本月已经处理'); return; }
    if (selected.dueDay > Number(TODAY.slice(-2))) { notify(`将在本月 ${selected.dueDay} 日到期`); return; }
    const transaction: Transaction = { id: uid('transaction'), kind: selected.kind === 'subscription' ? 'expense' : 'transfer', amount: selected.amount, accountAmount: selected.amount, currency: selected.currency, merchant: selected.name, category: selected.kind === 'subscription' ? '订阅' : '信用卡还款', accountId: selected.accountId, targetAccountId: selected.targetAccountId, source: '自动扣款确认', reimbursable: false, reimbursed: false, recurringRuleId: selected.id, createdAt: localStamp() };
    if (!canApplyLedger(data.accounts, transaction)) { notify('还款金额不能超过当前欠款；请先编辑账单金额'); return; }
    setData((current) => {
      const rule = current.recurringRules.find((item) => item.id === id);
      if (!rule || !rule.enabled || rule.lastRunPeriod === MONTH || !canApplyLedger(current.accounts, transaction)) return current;
      return { ...current, transactions: [transaction, ...current.transactions], accounts: applyLedger(current.accounts, transaction, 1), recurringRules: current.recurringRules.map((item) => item.id === id ? { ...item, lastRunPeriod: MONTH } : item) };
    });
    notify(selected.kind === 'subscription' ? '订阅扣款已确认入账' : '信用卡还款已确认转账');
  }
  function organizeCapture(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (captureText.trim()) setDraft(parseCapture(captureText.trim(), data.accounts)); }
  function startVoiceCapture() {
    const native = (window as Window & { SelfAgentNative?: { startVoiceCapture?: () => void } }).SelfAgentNative;
    if (!native?.startVoiceCapture) { notify('请在 Android App 中使用语音'); return; }
    notify('请开始说话');
    native.startVoiceCapture();
  }
  function pickCaptureImage() {
    const native = (window as Window & { SelfAgentNative?: { pickCaptureImage?: () => void } }).SelfAgentNative;
    if (!native?.pickCaptureImage) { notify('请在 Android App 中选择图片'); return; }
    notify('正在识别图片文字');
    native.pickCaptureImage();
  }
  function confirmDraft() {
    if (!draft) return;
    if (draft.kind === 'expense') {
      if (!draft.amount) { notify('请先补充金额'); return; }
      if (!draft.accountId || !data.accounts.some((account) => account.id === draft.accountId)) { notify('请先到财务页添加一个账户'); return; }
      saveTransaction(draft); notify('已确认并记入账本');
    } else if (draft.kind === 'travel') {
      if (!draft.number || !draft.from || !draft.to) { notify('请补充车次/航班和起终点'); return; }
      const item: TravelItem = { id: uid('travel'), kind: draft.travelKind, number: draft.number, from: draft.from, to: draft.to, departAt: `${draft.date}T${draft.departTime}`, arriveAt: `${draft.date}T${draft.arriveTime || draft.departTime}`, seat: '待分配', terminal: '待确认', status: 'upcoming', source: 'import', verified: false };
      setData((current) => ({ ...current, travels: [...current.travels, item].sort((a, b) => a.departAt.localeCompare(b.departAt)) }));
      notify('已确认并加入行程');
    } else if (draft.kind === 'health') {
      if (!(draft.value > 0)) { notify('请补充有效数值'); return; }
      const record: HealthRecord = { id: uid('health'), kind: draft.metric, value: draft.value, note: `一句话记录 · ${HEALTH_METRIC_LABELS[draft.metric]}`, createdAt: localStamp() };
      setData((current) => ({ ...current, healthRecords: [record, ...current.healthRecords] }));
      notify('已确认并加入健康记录');
    } else {
      const item: ScheduleItem = { id: uid('schedule'), title: draft.title, date: draft.date, time: draft.time, detail: '一句话记录 · 提前 10 分钟提醒', color: 'orange', done: false };
      const nextSchedules = [...data.schedules, item];
      setData((current) => ({ ...current, schedules: nextSchedules }));
      pushReminders(nextSchedules, data.recurringRules);
      notify('已确认并加入日程');
    }
    setDraft(null); setCaptureText('');
  }
  function addHealthRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const kind = String(form.get('kind')) as HealthRecord['kind'];
    const labels: Record<HealthRecord['kind'], string> = { sleep: '睡眠', meal: '饮食', exercise: '运动', steps: '步数', height: '身高', weight: '体重', heartRate: '心率', stress: '压力', pai: 'PAI' };
    const record: HealthRecord = { id: uid('health'), kind, value: Number(form.get('value')), note: String(form.get('note') || labels[kind]), createdAt: localStamp() };
    setData((current) => ({ ...current, healthRecords: [record, ...current.healthRecords] })); setSheet(null); notify('健康记录已保存到本机');
  }
  function saveBodyMetrics(height: number, weight: number) {
    const createdAt = localStamp();
    const records: HealthRecord[] = [
      { id: uid('health'), kind: 'height', value: height, note: '身体资料 · 身高', createdAt, externalKey: 'manual:profile:height' },
      { id: uid('health'), kind: 'weight', value: weight, note: '身体资料 · 体重', createdAt, externalKey: 'manual:profile:weight' },
    ];
    setData((current) => ({ ...current, healthRecords: upsertByExternalKey(current.healthRecords, records) }));
    notify('身高体重已保存，管家可以读取');
  }
  function addTravel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const item: TravelItem = { id: uid('travel'), kind: String(form.get('kind')) as TravelItem['kind'], number: String(form.get('number')), from: String(form.get('from')), to: String(form.get('to')), departAt: String(form.get('departAt')), arriveAt: String(form.get('arriveAt')), seat: String(form.get('seat') || '待分配'), terminal: String(form.get('terminal') || '待确认'), status: 'upcoming', source: 'manual', verified: true };
    setData((current) => ({ ...current, travels: [...current.travels, item].sort((a, b) => a.departAt.localeCompare(b.departAt)) })); setSheet(null); notify('行程已保存到本机');
  }
  function requestTravelSync() {
    const native = (window as Window & { SelfAgentNative?: { openNotificationAccess?: () => void } }).SelfAgentNative;
    native?.openNotificationAccess?.();
    notify('请打开通知使用权。12306/航司短信或通知会自动识别成行程。');
  }
  function requestQuoteRefresh() {
    const native = (window as Window & { SelfAgentNative?: { refreshQuotes?: () => void } }).SelfAgentNative;
    if (!native?.refreshQuotes) { notify('请在 Android App 中每天 18:00 自动刷新'); return; }
    native.refreshQuotes();
    notify('正在拉取今日参考汇率和收盘价');
  }
  function importHealth() {
    const native = (window as Window & { SelfAgentNative?: { importGadgetbridge?: () => void } }).SelfAgentNative;
    if (native?.importGadgetbridge) native.importGadgetbridge();
    else notify('请在 Android App 中选择 Gadgetbridge 自动导出的数据库或 ZIP（含 v6 睡眠）。');
  }
  function addHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const accountId = String(form.get('accountId'));
    const account = data.accounts.find((item) => item.id === accountId);
    const currentPrice = Number(form.get('currentPrice'));
    if (!account) { notify('请选择有效的理财账户'); return; }
    const previous = editingHoldingId ? data.investments.find((item) => item.id === editingHoldingId) : undefined;
    const todayPoint = { date: TODAY.slice(5), price: currentPrice };
    const holding: InvestmentHolding = { id: previous?.id ?? uid('holding'), accountId, kind: String(form.get('kind')) as InvestmentKind, name: String(form.get('name')), code: String(form.get('code')).trim().toUpperCase(), contract: String(form.get('contract')).trim(), network: String(form.get('network')).trim(), quantity: Number(form.get('quantity')), averageCost: Number(form.get('averageCost')), currentPrice, currency: account.currency, updatedAt: TODAY, quoteStatus: 'manual', history: previous ? [...previous.history.filter((item) => item.date !== todayPoint.date), todayPoint].slice(-30) : [todayPoint] };
    if ((holding.kind === 'stock' || holding.kind === 'fund') && !holding.code) { notify('基金或股票需要填写代码'); return; }
    if (holding.kind === 'meme' && !holding.contract) { notify('Meme 币需要填写合约地址'); return; }
    setData((current) => {
      const investments = previous ? current.investments.map((item) => item.id === previous.id ? holding : item) : [...current.investments, holding];
      return { ...current, investments, accounts: syncInvestmentBalances(current.accounts, investments) };
    });
    setEditingHoldingId(null); setSheet(null); setSelectedAccountId(accountId); notify(previous ? '持仓与今日净值已更新' : '理财产品已添加');
  }
  function deleteHolding() {
    const selected = editingHoldingId ? data.investments.find((item) => item.id === editingHoldingId) : undefined;
    if (!selected || !window.confirm('确定删除这个理财产品吗？历史收益记录也会删除。')) return;
    setData((current) => { const investments = current.investments.filter((item) => item.id !== selected.id); return { ...current, investments, accounts: syncInvestmentBalances(current.accounts, investments) }; });
    setEditingHoldingId(null); setSelectedHoldingId(null); setSheet(null); notify('理财产品已删除');
  }
  function togglePrivacy(key: keyof PrivacySettings) { setData((current) => ({ ...current, privacy: { ...current.privacy, [key]: !current.privacy[key] } })); }
  function toggleMemory(id: string) { setData((current) => ({ ...current, memories: current.memories.map((item) => item.id === id ? { ...item, active: !item.active, updatedAt: localStamp() } : item) })); }
  function deleteMemory(id: string) { if (window.confirm('确定删除这条管家记忆吗？')) setData((current) => ({ ...current, memories: current.memories.filter((item) => item.id !== id) })); }
  function upsertMemory(next: MemoryItem, previousId?: string) {
    setData((current) => ({
      ...current,
      memories: previousId
        ? current.memories.map((item) => item.id === previousId ? next : item)
        : [...current.memories, next],
    }));
  }
  function applyButlerAction(action: ButlerAction) {
    if (action.type === 'create_schedule') {
      const item: ScheduleItem = { id: uid('schedule'), title: action.payload.title, date: action.payload.date, time: action.payload.time, detail: '管家草稿 · 提前 10 分钟提醒', color: 'orange', done: false };
      const nextSchedules = [...data.schedules, item];
      setData((current) => ({ ...current, schedules: nextSchedules }));
      pushReminders(nextSchedules, data.recurringRules);
      notify('已确认并加入日程');
      return;
    }
    if (action.type === 'create_expense') {
      const accountId = defaultCashId(data.accounts, 'CNY') || data.accounts[0]?.id || '';
      if (!accountId) { notify('请先到财务页添加一个账户'); return; }
      const account = data.accounts.find((item) => item.id === accountId);
      saveTransaction({ kind: 'expense', amount: action.payload.amount, merchant: action.payload.merchant, category: action.payload.category || '其他', accountId, source: action.payload.source || '管家草稿确认', currency: account?.currency ?? 'CNY', reimbursable: false });
      notify('已确认并记入账本');
      return;
    }
    if (action.type === 'create_travel') {
      const item: TravelItem = { id: uid('travel'), kind: action.payload.travelKind, number: action.payload.number, from: action.payload.from, to: action.payload.to, departAt: `${action.payload.date}T${action.payload.departTime}`, arriveAt: `${action.payload.date}T${action.payload.arriveTime || action.payload.departTime}`, seat: '待分配', terminal: '待确认', status: 'upcoming', source: 'import', verified: false };
      setData((current) => ({ ...current, travels: [...current.travels, item].sort((left, right) => left.departAt.localeCompare(right.departAt)) }));
      notify('已确认并加入行程');
      return;
    }
    if (action.type === 'create_health') {
      const record: HealthRecord = { id: uid('health'), kind: action.payload.metric, value: action.payload.value, note: `管家草稿 · ${HEALTH_METRIC_LABELS[action.payload.metric]}`, createdAt: localStamp() };
      setData((current) => ({ ...current, healthRecords: [record, ...current.healthRecords] }));
      notify('已确认并加入健康记录');
      return;
    }
    if (action.type === 'add_memory') {
      const memory = normalizeMemory({ id: uid('memory'), kind: action.payload.kind === '目标' || action.payload.kind === '偏好' ? action.payload.kind : '观察', title: action.payload.title, note: action.payload.note || '', active: true, source: '用户确认的管家草稿', purpose: action.payload.purpose || action.payload.note || '用于管家建议', updatedAt: localStamp() });
      upsertMemory({ ...memory, kind: memory.kind === '目标' || memory.kind === '偏好' ? memory.kind : '观察' });
      notify('已确认并新增记忆');
      return;
    }
    if (action.type === 'update_memory') {
      setData((current) => ({
        ...current,
        memories: current.memories.map((item) => item.id === action.payload.id ? { ...item, title: action.payload.title || item.title, note: action.payload.note ?? item.note, purpose: action.payload.purpose || item.purpose, updatedAt: localStamp() } : item),
      }));
      notify('记忆已更新');
      return;
    }
    if (action.type === 'pause_memory') {
      setData((current) => ({ ...current, memories: current.memories.map((item) => item.id === action.payload.id ? { ...item, active: false, updatedAt: localStamp() } : item) }));
      notify('记忆已暂停');
      return;
    }
    if (action.type === 'delete_memory') deleteMemory(action.payload.id);
  }
  function toggleTheme() { setData((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' })); }
  function exportLocalData() {
    const safe = { ...data, vaultItems: data.vaultItems.map(({ id, title, usernameHint, note }) => ({ id, title, usernameHint, note })) };
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' })); link.download = `self-agent-data-${TODAY}.json`; link.click(); URL.revokeObjectURL(link.href); notify('已导出脱敏本机数据');
  }
  async function importLocalData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      if (!isBackupPayload(raw)) { notify('备份格式不正确，现有数据未改变'); return; }
      if (!window.confirm('导入将替换当前日程、账本和设置，是否继续？')) return;
      setData(normalizeData(raw as Partial<AppData>));
      notify('备份已恢复，可以重新查看和编辑');
    } catch { notify('无法读取备份，现有数据未改变'); }
  }
  function loadDemoData() {
    const hasData = data.schedules.length + data.transactions.length + data.accounts.length > 0;
    if (hasData && !window.confirm('加载演示数据会替换当前记录，是否继续？')) return;
    setData(demoData); notify('已加载演示数据，页面会持续显示演示标识');
  }
  function clearLocalData() {
    if (!window.confirm('确定清空本机日程、账本、健康、行程和 AI 设置吗？密码库不会被清空。')) return;
    setData(emptyData); setAiConfig(emptyAi); window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(AI_CONFIG_KEY); notify('本机业务数据已清空');
  }
  function pageTitle() { return tab === 'schedule' ? '日程与行动' : tab === 'capture' ? '快速记录' : tab === 'finance' ? selectedHoldingId ? '收益详情' : selectedAccountId ? '账户账单' : '我的财务' : tab === 'profile' ? '我的' : tab === 'health' ? '健康记录' : tab === 'travel' ? '我的出行' : tab === 'data' ? '数据中心' : tab === 'butler' ? '本机管家' : tab === 'privacy' ? '隐私与权限' : tab === 'memory' ? '记忆管理' : tab === 'vault' ? '密码库' : '今天'; }

  return <main className={`phone-app ${data.theme === 'dark' ? 'dark' : ''}`}>
    <header className="app-header"><button className="round" aria-label="返回" onClick={() => { if (!goBack()) notify('已经在首页'); }}>‹</button><div><span>SELF AGENT · 本机优先</span><h1>{pageTitle()}</h1></div><button className="round status-dot" aria-label="打开设置" onClick={() => navigate('profile')}><i />设</button></header>

    {tab === 'home' && <div className="page home-page">
      {data.demoMode && <section className="demo-banner"><strong>当前为演示数据</strong><span>以下资产、日程和健康记录不代表你的真实信息。</span><button onClick={clearLocalData}>退出演示并清空</button></section>}
      <section className="hero-card"><span>{TODAY_LABEL}</span><h2>{GREETING}</h2><p>所有内容先整理、确认后再保存。</p></section>
      {!hasBusinessData && <section className="onboarding-card"><span>从一件真实的事开始</span><h2>这里还没有你的数据</h2><p>不用一次授权全部功能。先添加一个日程或账户，其他能力需要时再开启。</p><div><button onClick={() => { setEditingScheduleId(null); setSheet('schedule'); }}>添加第一条日程</button><button onClick={() => { navigate('finance'); setEditingAccountId(null); setSheet('account'); }}>添加第一个账户</button></div></section>}
      {nativeOn && (!caps.accessibility || !caps.notificationListener || !caps.autofill) && <section className="capability-card"><strong>系统能力状态</strong><p>无障碍自动记账：{caps.accessibility ? '已开启' : '未开启'}。通知读取：{caps.notificationListener ? '已开启' : '未开启'}。自动填充：{caps.autofill ? '已设为 Self Agent' : '未选择'}。打开设置后回到这里会重新检测，不会把“已打开设置页”当成已启用。</p><button onClick={() => navigate('profile')}>去授权并复查</button></section>}
      <section className="summary-grid"><button onClick={() => navigate('schedule')}><span>下一项 · {nextSchedule?.time ?? '空闲'}</span><strong>{nextSchedule?.title ?? '今天没有更多日程'}</strong><small>{data.schedules.filter((item) => item.date === TODAY && item.done).length}/{data.schedules.filter((item) => item.date === TODAY).length} 已完成</small></button><button onClick={() => navigate('finance')}><span>今日支出</span><strong>¥ {money(todaySpend)}</strong><small>净资产 {totalBalanceLabel}</small></button></section>
      <section className="section-block"><div className="section-title"><div><span>QUICK CAPTURE</span><h2>一句话交给管家</h2></div></div><button className="capture-callout" onClick={() => navigate('capture')}><span>＋</span><div><strong>记录一件事</strong><small>例如“午饭 36 元，微信支付”</small></div><b>›</b></button></section>
      <section className="section-block"><div className="section-title"><div><span>FEATURES</span><h2>生活工具</h2></div></div><div className="feature-grid"><button onClick={() => navigate('travel')}><span>行</span><strong>出行</strong><small>火车与航班</small></button><button onClick={() => navigate('health')}><span>健</span><strong>健康</strong><small>身高体重心率</small></button><button onClick={() => navigate('butler')}><span>管</span><strong>管家</strong><small>本机摘要问答</small></button><button onClick={() => navigate('data')}><span>数</span><strong>数据</strong><small>统一趋势</small></button><button onClick={() => navigate('vault')}><span>钥</span><strong>密码库</strong><small>安全元数据</small></button></div></section>
      <section className="section-block"><div className="section-title"><div><span>RECENT</span><h2>最近入账</h2></div><button onClick={() => navigate('finance')}>查看全部</button></div><TransactionList items={data.transactions.slice(0, 3)} accounts={data.accounts} onEdit={(id) => { setEditingTransactionId(id); setSheet('transaction'); }} onDelete={(id) => deleteTransaction(id)} onSettle={(id) => settleReimbursement(id)} /></section>
    </div>}

    {tab === 'schedule' && <div className="page schedule-page"><section className="calendar"><div className="week-title"><button aria-label="上一周" onClick={() => setSelectedDate(addDaysKey(selectedDate, -7))}>‹</button><strong>{weekTitle}</strong><button aria-label="下一周" onClick={() => setSelectedDate(addDaysKey(selectedDate, 7))}>›</button></div><div className="dates">{dateOptions.map((date) => <button key={date.value} onClick={() => setSelectedDate(date.value)} className={selectedDate === date.value ? 'active' : ''}><span>{date.weekday}</span><b>{date.day}</b>{date.value === TODAY && <i />}</button>)}</div></section><section className="day-section"><div className="day-heading"><div><span>{selectedDate === TODAY ? '今天' : `${Number(selectedDate.slice(-2))}日`} · 星期{dateOptions.find((date) => date.value === selectedDate)?.weekday}</span><h2>{selectedSchedules.length ? '这一天的安排' : '给这一天留点空白'}</h2></div><small>{selectedSchedules.filter((item) => item.done).length}/{selectedSchedules.length} 完成</small></div>{selectedSchedules.length ? <div className="timeline">{selectedSchedules.map((item, index) => <article className={item.done ? 'done' : ''} key={item.id}><time>{item.time}</time><div className="track"><i className={item.color} />{index < selectedSchedules.length - 1 && <span />}</div><SwipeScheduleRow item={item} onToggle={() => toggleSchedule(item.id)} onEdit={() => { setEditingScheduleId(item.id); setSheet('schedule'); }} onDelete={() => deleteSchedule(item.id)} /></article>)}</div> : <div className="empty"><span>○</span><h3>没有日程</h3><p>给这一天留点空白，或添加一件事。</p><button onClick={() => setSheet('schedule')}>添加日程</button></div>}</section></div>}

    {tab === 'capture' && <div className="page capture-page"><section className="capture-intro"><span>INBOX</span><h2>先说下来，我来整理。</h2><p>可识别日程、账目、出行或健康；确认后才会保存。可用语音或图片文字。</p></section><form className="capture-box" onSubmit={organizeCapture}><textarea aria-label="一句话记录" maxLength={400} value={captureText} onChange={(event) => setCaptureText(event.target.value)} placeholder={'例如：明天 9 点提醒我交水电费\n午饭 36 元，微信支付\n明天 G11 北京南到上海虹桥 9:00\n今天走了 8000 步'} /><div className="capture-tools"><button type="button" onClick={startVoiceCapture}><span aria-hidden="true">🎤</span>语音</button><button type="button" onClick={pickCaptureImage}><span aria-hidden="true">🖼</span>图片</button></div><div><small>{captureText.length}/400</small><button type="submit">整理一下</button></div></form><div className="suggestion-row"><button onClick={() => setCaptureText('午饭 36 元，微信支付')}>午饭 36 元</button><button onClick={() => setCaptureText('明天 9 点提醒我交水电费')}>明天 9 点提醒</button><button onClick={() => setCaptureText('明天 G11 北京南到上海虹桥 9:00')}>G11 出行</button><button onClick={() => setCaptureText('今天走了 8000 步')}>8000 步</button></div>{draft && <section className="draft-card"><header><div><span>待确认 · {draft.kind === 'expense' ? '支出' : draft.kind === 'travel' ? '出行' : draft.kind === 'health' ? '健康' : '日程'}</span><h3>我整理成这样</h3></div><button aria-label="取消草稿" onClick={() => setDraft(null)}>×</button></header>{draft.kind === 'expense' ? <><div className="draft-fields"><label>金额<input inputMode="decimal" value={draft.amount || ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} /></label><label>币种<select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value as Currency })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label><label>商家 / 用途<input value={draft.merchant} onChange={(event) => setDraft({ ...draft, merchant: event.target.value })} /></label><label>分类<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>餐饮</option><option>交通</option><option>生活</option><option>医疗</option><option>其他</option></select></label><label>账户<select value={draft.accountId} onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label></div><label className="check-option"><input type="checkbox" checked={draft.reimbursable} onChange={(event) => setDraft({ ...draft, reimbursable: event.target.checked })} />加入待报销（记入债务·应收）</label></> : draft.kind === 'travel' ? <div className="draft-fields"><label>类型<select value={draft.travelKind} onChange={(event) => setDraft({ ...draft, travelKind: event.target.value as TravelKind })}><option value="train">火车</option><option value="flight">航班</option></select></label><label>车次 / 航班<input value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value })} /></label><label>出发地<input value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label><label>目的地<input value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label><label>日期<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>出发时间<input type="time" value={draft.departTime} onChange={(event) => setDraft({ ...draft, departTime: event.target.value })} /></label><label>到达时间<input type="time" value={draft.arriveTime || ''} onChange={(event) => setDraft({ ...draft, arriveTime: event.target.value })} /></label></div> : draft.kind === 'health' ? <div className="draft-fields"><label>指标<select value={draft.metric} onChange={(event) => setDraft({ ...draft, metric: event.target.value as HealthMetric })}>{(Object.keys(HEALTH_METRIC_LABELS) as HealthMetric[]).map((metric) => <option key={metric} value={metric}>{HEALTH_METRIC_LABELS[metric]}</option>)}</select></label><label>数值<input inputMode="decimal" value={draft.value || ''} onChange={(event) => setDraft({ ...draft, value: Number(event.target.value) })} /></label></div> : <div className="draft-fields"><label>日程名称<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>日期<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>时间<input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} /></label></div>}<button className="confirm-button" onClick={confirmDraft}>确认保存</button></section>}</div>}

    {tab === 'finance' && <FinancePanel data={data} currency={financeCurrency} selectedAccountId={selectedAccountId} selectedHoldingId={selectedHoldingId} onCurrency={setFinanceCurrency} onSelectAccount={(id) => { setSelectedAccountId(id); setSelectedHoldingId(null); }} onSelectHolding={setSelectedHoldingId} onBackAccount={() => setSelectedAccountId(null)} onBackHolding={() => setSelectedHoldingId(null)} onNewTransaction={() => { setEditingTransactionId(null); setSheet('transaction'); }} onEditTransaction={(id) => { setEditingTransactionId(id); setSheet('transaction'); }} onNewAccount={() => { setEditingAccountId(null); setSheet('account'); }} onEditAccount={(id) => { setEditingAccountId(id); setSheet('account'); }} onNewHolding={() => { setEditingHoldingId(null); setSheet('holding'); }} onEditHolding={(id) => { setEditingHoldingId(id); setSheet('holding'); }} onNewRecurring={() => { setEditingRecurringId(null); setSheet('recurring'); }} onEditRecurring={(id) => { setEditingRecurringId(id); setSheet('recurring'); }} onDeleteRecurring={(id) => deleteRecurringRule(id)} onDeleteTransaction={(id) => deleteTransaction(id)} onRunRecurring={runRecurringRule} onToggleRecurring={toggleRecurringRule} onSettleReimbursement={settleReimbursement} onSettleAccount={settleAccount} onNewRate={() => { setEditingRateCurrency(null); setSheet('exchange-rate'); }} onEditRate={(currency) => { setEditingRateCurrency(currency); setSheet('exchange-rate'); }} onDeleteRate={deleteExchangeRate} onRefreshQuotes={requestQuoteRefresh} />}

    {tab === 'profile' && <div className="page profile-page"><section className="profile-heading"><div>SA</div><span>SELF AGENT</span><h2>数据留在你的设备上</h2><p>界面和记录都在手机里运行，不依赖服务器。敏感能力由系统权限授权。</p></section><section className="profile-menu"><button onClick={() => navigate('memory')}><span>忆</span><div><strong>AI 记忆管理</strong><small>查看、暂停或删除管家记忆</small></div><b>›</b></button><button onClick={() => navigate('privacy')}><span>盾</span><div><strong>隐私与权限</strong><small>分别控制健康、财务和日程摘要</small></div><b>›</b></button><button onClick={() => navigate('vault')}><span>钥</span><div><strong>密码库</strong><small>不在网页保存密码明文</small></div><b>›</b></button><button onClick={() => navigate('data')}><span>数</span><div><strong>数据中心</strong><small>健康、财务与行动统一摘要</small></div><b>›</b></button></section><form className="ai-box" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const next = { baseUrl: String(form.get('baseUrl')).trim().replace(/\/$/, ''), model: String(form.get('model')).trim() || 'gpt-4o-mini', apiKey: String(form.get('apiKey')).trim() }; setAiConfig(next); window.localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next)); notify('AI 接口已保存在本机，不会进入密码库或导出文件'); }}><strong>AI 接口</strong><p>兼容 OpenAI Chat Completions。密钥只存在本机，提问时不会发送密码。</p><label>接口地址<input name="baseUrl" placeholder="https://api.openai.com/v1" defaultValue={aiConfig.baseUrl} /></label><label>模型<input name="model" defaultValue={aiConfig.model} /></label><label>API Key<input name="apiKey" type="password" autoComplete="off" defaultValue={aiConfig.apiKey} /></label><button className="save" type="submit" style={{ marginTop: 12 }}>保存接口</button></form>{nativeOn && <div className="native-actions"><button type="button" onClick={() => (window as Window & { SelfAgentNative?: { openAccessibilitySettings?: () => void } }).SelfAgentNative?.openAccessibilitySettings?.()}>第1步：打开无障碍（自动记账）</button><button type="button" onClick={() => (window as Window & { SelfAgentNative?: { openNotificationAccess?: () => void } }).SelfAgentNative?.openNotificationAccess?.()}>第2步：打开通知使用权</button><button type="button" onClick={() => (window as Window & { SelfAgentNative?: { openAutofillSettings?: () => void } }).SelfAgentNative?.openAutofillSettings?.()}>第3步：设为自动填充服务</button></div>}<HowToNative /><section className="profile-actions"><button onClick={toggleTheme}>{data.theme === 'dark' ? '切换浅色模式' : '切换深色模式'}</button><button onClick={exportLocalData}>导出全部数据</button><label className="file-action">从备份恢复<input hidden type="file" accept="application/json,.json" onChange={importLocalData} /></label><button onClick={loadDemoData}>加载演示数据</button><button className="danger-text" onClick={clearLocalData}>清空本机数据</button></section><p className="privacy-note">Android 通知记账需系统授权；确认前不会改余额。密码只进入 Keystore，不会发给 AI。</p></div>}

    {tab === 'health' && <HealthPanel records={data.healthRecords} onAdd={() => setSheet('health')} onImport={importHealth} onSaveBody={saveBodyMetrics} />}
    {tab === 'travel' && <TravelPanel items={data.travels} onSync={requestTravelSync} onAdd={() => setSheet('travel')} onDelete={(id) => { setData((current) => ({ ...current, travels: current.travels.filter((item) => item.id !== id) })); notify('行程已删除'); }} />}
    {tab === 'data' && <DataPanel data={data} />}
    {tab === 'butler' && <ButlerPanel data={data} ai={aiConfig} onConfirmAction={applyButlerAction} />}
    {tab === 'privacy' && <PrivacyPanel settings={data.privacy} onToggle={togglePrivacy} />}
    {tab === 'memory' && <MemoryPanel items={data.memories} onToggle={toggleMemory} onDelete={deleteMemory} />}
    {tab === 'vault' && <VaultPanel items={nativeOn && vaultMeta.length ? vaultMeta : data.vaultItems} nativeOn={nativeOn} onReveal={(id) => (window as Window & { SelfAgentNative?: { revealPassword?: (id: string) => void } }).SelfAgentNative?.revealPassword?.(id)} />}

    {(tab === 'schedule' || tab === 'finance') && <button className="add-button" onClick={() => { if (tab === 'finance') setEditingTransactionId(null); if (tab === 'schedule') setEditingScheduleId(null); setSheet(tab === 'schedule' ? 'schedule' : 'transaction'); }} aria-label={tab === 'schedule' ? '新建日程' : '新建流水'}>＋</button>}
    <nav className="bottom-nav" aria-label="主导航">{navItems.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>

    {sheet === 'schedule' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingSchedule?.id ?? 'new-schedule'} onSubmit={addSchedule} className="sheet"><div className="handle" /><header><div><span>{editingSchedule ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}</span><h2>{editingSchedule ? '编辑日程' : '新建日程'}</h2></div><button type="button" onClick={() => { setSheet(null); setEditingScheduleId(null); }}>×</button></header><label>日程名称<input required autoFocus name="title" placeholder="例如：准备周末徒步装备" defaultValue={editingSchedule?.title} /></label><div className="row"><label>日期<input required name="date" type="date" defaultValue={editingSchedule?.date ?? selectedDate} /></label><label>时间<input required name="time" type="time" defaultValue={editingSchedule?.time ?? '10:00'} /></label></div><label>类型<input name="detail" placeholder="个人、工作或健康" defaultValue={editingSchedule?.detail?.split(' · ')[0] ?? '个人'} /></label><small className="form-tip">会提前 10 分钟弹一次，到点再弹一次。请允许通知。</small><button className="save" type="submit">{editingSchedule ? '保存修改' : '确认添加'}</button>{editingSchedule && <button className="danger-button" type="button" onClick={() => deleteSchedule(editingSchedule.id)}>删除这条日程</button>}</form></div>}
    {sheet === 'transaction' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingTransaction?.id ?? 'new-transaction'} onSubmit={addTransaction} className="sheet scroll-sheet"><div className="handle" /><header><div><span>{editingTransaction ? 'EDIT RECORD' : 'NEW RECORD'}</span><h2>{editingTransaction ? '编辑账目' : '确认一笔流水'}</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>类型<select name="kind" defaultValue={editingTransaction?.kind ?? 'expense'}><option value="expense">支出</option><option value="income">收入</option><option value="transfer">账户转账</option></select></label><label>金额<input required name="amount" inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" defaultValue={editingTransaction?.amount} /></label></div><div className="row"><label>币种<select name="currency" defaultValue={editingTransaction?.currency ?? financeCurrency}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label><label>入账汇率<input required name="exchangeRate" type="number" min="0.000001" step="0.000001" defaultValue={editingTransaction ? editingTransaction.accountAmount / editingTransaction.amount : 1} /></label></div><label>商家 / 用途<input required name="merchant" placeholder="例如：午餐" defaultValue={editingTransaction?.merchant} /></label><div className="row"><label>支出账户（钱从哪出去）<select name="accountId" defaultValue={editingTransaction?.accountId}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label><label>报销记入（待收回）<select name="reimburseToAccountId" defaultValue={editingTransaction?.reimburseAccountId ?? data.accounts.find((account) => accountRole(account.type) === 'receivable')?.id}>{data.accounts.filter((account) => accountRole(account.type) === 'receivable').map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label><label>报销后打入账户<select name="reimburseDepositAccountId" defaultValue={editingTransaction?.targetAccountId ?? editingTransaction?.accountId}>{data.accounts.filter((account) => canHoldMoney(account)).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label></div><label>转入账户（仅转账）<select name="targetAccountId" defaultValue={editingTransaction?.targetAccountId}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label><label>分类<select name="category" defaultValue={editingTransaction?.category}><option>餐饮</option><option>交通</option><option>生活</option><option>医疗</option><option>订阅</option><option>其他</option><option>账户转账</option></select></label><label className="check-option"><input name="reimbursable" type="checkbox" defaultChecked={editingTransaction?.reimbursable} />待报销（垫付时增加待收回）</label><small className="form-tip">勾选待报销：支出账户减少，待收回增加。报销后打入账户要等流水点「入账」才会到账。</small><button className="save" type="submit">{editingTransaction ? '保存修改' : '确认入账'}</button>{editingTransaction && <button className="danger-button" type="button" onClick={() => deleteTransaction(editingTransaction?.id)}>删除这笔账目</button>}</form></div>}
    {sheet === 'account' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingAccount?.id ?? 'new-account'} onSubmit={addAccount} className="sheet"><div className="handle" /><header><div><span>{editingAccount ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</span><h2>{editingAccount ? '编辑账户' : '添加自定义账户'}</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><label>账户名称<input required autoFocus name="name" placeholder="例如：港币旅行卡" defaultValue={editingAccount?.name} /></label><div className="row"><label>账户类型<select name="type" defaultValue={editingAccount?.type}>{accountTypes.map((type) => <option key={type} value={type}>{type}{accountRole(type) === 'receivable' ? ' · 债务应收' : isDebtRole(accountRole(type)) ? ' · 债务应付' : ''}</option>)}</select></label><label>币种<select name="currency" defaultValue={editingAccount?.currency}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div><label>{editingAccount && isDebtRole(accountRole(editingAccount.type)) ? '当前欠款' : accountRole(editingAccount?.type || '') === 'receivable' ? '应收余额' : '当前余额'}<input name="balance" type="number" step="0.01" defaultValue={editingAccount?.balance ?? 0} /></label><small className="form-tip">{editingAccount && isDebtRole(accountRole(editingAccount.type)) ? '欠款和信用卡是债务·应付，填你还欠多少。' : accountRole(editingAccount?.type || '') === 'receivable' ? '待收回是债务·应收，别人欠你的钱。报销不用单独开账户。' : '可直接调整余额。'}</small><button className="save" type="submit">{editingAccount ? '保存修改' : '保存账户'}</button></form></div>}
    {sheet === 'settle-account' && settlingAccount && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={settlingAccount.id} onSubmit={confirmAccountSettlement} className="sheet"><div className="handle" /><header><div><span>SETTLE ACCOUNT</span><h2>{isDebtRole(accountRole(settlingAccount.type)) ? '还多少、用哪个账户' : '收回多少、进哪个账户'}</h2></div><button type="button" onClick={() => { setSheet(null); setSettlingAccountId(null); }}>×</button></header><p className="form-tip">{settlingAccount.name} 当前{isDebtRole(accountRole(settlingAccount.type)) ? '欠款' : '应收'} {currencyMark(settlingAccount.currency)} {money(settlingAccount.balance)}</p><label>{isDebtRole(accountRole(settlingAccount.type)) ? '还款金额' : '收回金额'}<input required name="amount" type="number" min="0.01" max={settlingAccount.balance} step="0.01" defaultValue={settlingAccount.balance} /></label><label>{isDebtRole(accountRole(settlingAccount.type)) ? '用哪个资金账户还' : '收到哪个资金账户'}<select name="counterpartId" defaultValue={defaultCashId(data.accounts, settlingAccount.currency)}>{data.accounts.filter((account) => canHoldMoney(account) && account.currency === settlingAccount.currency && account.id !== settlingAccount.id).map((account) => <option key={account.id} value={account.id}>{account.name} · 余额 {currencyMark(account.currency)}{money(account.balance)}</option>)}</select></label><small className="form-tip">{isDebtRole(accountRole(settlingAccount.type)) ? '不会自动还清。你填多少、选哪个账户，就从那个账户扣多少。' : '不会自动全部收回。你填多少、选哪个账户，钱就进那个账户。'}</small><button className="save" type="submit">{isDebtRole(accountRole(settlingAccount.type)) ? '确认还款' : '确认收回'}</button></form></div>}
    {sheet === 'recurring' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingRecurring?.id ?? 'new-bill'} onSubmit={addRecurringRule} className="sheet scroll-sheet"><div className="handle" /><header><div><span>{editingRecurring ? 'EDIT BILL' : 'NEW BILL'}</span><h2>{editingRecurring ? '编辑每月账单' : '添加每月账单'}</h2></div><button type="button" onClick={() => { setSheet(null); setEditingRecurringId(null); }}>×</button></header><div className="row"><label>规则类型<select name="ruleKind" defaultValue={editingRecurring?.kind ?? 'subscription'}><option value="subscription">订阅扣款</option><option value="credit-card">信用卡还款</option></select></label><label>每月到期日<input name="dueDay" type="number" min="1" max="31" defaultValue={editingRecurring?.dueDay ?? 1} /></label></div><label>名称<input required name="name" placeholder="例如：视频会员" defaultValue={editingRecurring?.name} /></label><div className="row"><label>金额<input required name="amount" type="number" min="0.01" step="0.01" defaultValue={editingRecurring?.amount} /></label><label>币种<select name="currency" defaultValue={editingRecurring?.currency}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div><label>扣款账户<select name="accountId" defaultValue={editingRecurring?.accountId}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label><label>还款目标账户（订阅可忽略）<select name="targetAccountId" defaultValue={editingRecurring?.targetAccountId}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>{editingRecurring && <button type="button" className="rule-toggle" onClick={() => toggleRecurringRule(editingRecurring.id)}>{editingRecurring.enabled ? '暂停这条提醒' : '重新启用提醒'}</button>}<button className="save" type="submit">{editingRecurring ? '保存修改' : '保存账单'}</button>{editingRecurring && <button className="danger-button" type="button" onClick={() => deleteRecurringRule(editingRecurring.id)}>删除这条账单</button>}</form></div>}
    {sheet === 'exchange-rate' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingRateCurrency ?? 'new-rate'} onSubmit={addExchangeRate} className="sheet"><div className="handle" /><header><div><span>EXCHANGE RATE</span><h2>人民币汇率</h2></div><button type="button" onClick={() => { setSheet(null); setEditingRateCurrency(null); }}>×</button></header><label>原币种<select name="currency" defaultValue={editingRateCurrency ?? 'USD'}>{currencies.filter((currency) => currency !== 'CNY').map((currency) => <option key={currency}>{currency}</option>)}</select></label><label>1 单位原币 = 人民币<input required name="cnyRate" type="number" min="0.000001" step="0.000001" defaultValue={editingRateCurrency ? data.exchangeRates.find((item) => item.currency === editingRateCurrency)?.cnyRate : ''} placeholder="例如 USD 填 7.200000" /></label><label>适用日期<input required name="asOf" type="date" defaultValue={editingRateCurrency ? data.exchangeRates.find((item) => item.currency === editingRateCurrency)?.asOf : TODAY} /></label><small className="form-tip">仅保存你手动确认的汇率；不会联网编造行情。缺失汇率的币种不会计入人民币总额。</small><button className="save" type="submit">保存手动汇率</button>{editingRateCurrency && <button className="danger-button" type="button" onClick={() => { deleteExchangeRate(editingRateCurrency); setEditingRateCurrency(null); setSheet(null); }}>删除此汇率</button>}</form></div>}
    {sheet === 'health' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form onSubmit={addHealthRecord} className="sheet"><div className="handle" /><header><div><span>HEALTH RECORD</span><h2>添加健康记录</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>记录类型<select name="kind"><option value="height">身高 cm</option><option value="weight">体重 kg</option><option value="heartRate">心率 次/分</option><option value="stress">压力</option><option value="sleep">睡眠小时</option><option value="pai">PAI</option><option value="exercise">运动分钟</option><option value="meal">饮食餐数</option></select></label><label>数值<input required name="value" type="number" min="0" step="0.1" /></label></div><label>备注<input name="note" placeholder="例如：晨起心率、昨晚睡眠" /></label><small className="form-tip">管家只会在健康权限打开时读取这些数值，不等于诊断。</small><button className="save" type="submit">保存记录</button></form></div>}
    {sheet === 'travel' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form onSubmit={addTravel} className="sheet scroll-sheet"><div className="handle" /><header><div><span>NEW TRIP</span><h2>手动添加行程</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>类型<select name="kind"><option value="train">火车</option><option value="flight">航班</option></select></label><label>车次 / 航班号<input required name="number" placeholder="例如：G11" /></label></div><div className="row"><label>出发地<input required name="from" /></label><label>目的地<input required name="to" /></label></div><label>出发时间<input required name="departAt" type="datetime-local" /></label><label>到达时间<input required name="arriveAt" type="datetime-local" /></label><div className="row"><label>座位<input name="seat" placeholder="06车 08A" /></label><label>航站楼 / 检票口<input name="terminal" placeholder="T2 / 12A" /></label></div><button className="save" type="submit">保存行程</button></form></div>}
    {sheet === 'holding' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingHolding?.id ?? 'new-holding'} onSubmit={addHolding} className="sheet scroll-sheet"><div className="handle" /><header><div><span>{editingHolding ? 'EDIT ASSET' : 'NEW ASSET'}</span><h2>{editingHolding ? '更新理财产品' : '添加理财产品'}</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>产品类型<select name="kind" defaultValue={editingHolding?.kind ?? 'fund'}><option value="fund">基金 / ETF</option><option value="stock">股票</option><option value="crypto">虚拟货币</option><option value="meme">Meme 币</option></select></label><label>所属账户<select name="accountId" defaultValue={editingHolding?.accountId ?? selectedAccountId ?? undefined}>{data.accounts.filter((account) => account.type === '理财账户').map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label></div><label>产品名称<input required name="name" placeholder="例如：标普500 ETF" defaultValue={editingHolding?.name} /></label><label>基金 / 股票 / 币种代码<input name="code" placeholder="例如：510300.SH、AAPL、BTC" defaultValue={editingHolding?.code} /></label><div className="row"><label>网络<select name="network" defaultValue={editingHolding?.network}><option value="">非链上产品</option><option>Ethereum</option><option>Solana</option><option>BNB Chain</option><option>Base</option><option>Arbitrum</option><option>Polygon</option></select></label><label>合约地址<input name="contract" placeholder="Meme 币必填" defaultValue={editingHolding?.contract} /></label></div><div className="row"><label>持有数量<input required name="quantity" type="number" min="0" step="any" defaultValue={editingHolding?.quantity} /></label><label>平均成本<input required name="averageCost" type="number" min="0" step="any" defaultValue={editingHolding?.averageCost} /></label></div><label>当前价格 / 今日净值<input required name="currentPrice" type="number" min="0" step="any" defaultValue={editingHolding?.currentPrice} /></label><small className="form-tip">保存会形成今日收益点。连接行情服务后，App 可按代码或“网络 + 合约”每日自动更新。</small><button className="save" type="submit">{editingHolding ? '保存今日更新' : '添加产品'}</button>{editingHolding && <button className="danger-button" type="button" onClick={deleteHolding}>删除这个产品</button>}</form></div>}
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function SwipeScheduleRow({ item, onToggle, onEdit, onDelete }: { item: ScheduleItem; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="schedule-row">
      <button type="button" className="schedule-card" onClick={onToggle}>
        <div><strong>{item.title}</strong><small>{item.detail}</small></div>
        <span className="check">{item.done ? '✓' : ''}</span>
      </button>
      <div className="row-ops">
        <button type="button" className="edit" onClick={(event) => { event.stopPropagation(); onEdit(); }}>编辑</button>
        <button type="button" className="del" onClick={(event) => { event.stopPropagation(); onDelete(); }}>删除</button>
      </div>
    </div>
  );
}

function HealthPanel({ records, onAdd, onImport, onSaveBody }: { records: HealthRecord[]; onAdd: () => void; onImport: () => void; onSaveBody: (height: number, weight: number) => void }) {
  const cards: { kind: HealthRecord['kind']; mark: string; name: string; unit: string }[] = [
    { kind: 'height', mark: '高', name: '身高', unit: 'cm' },
    { kind: 'weight', mark: '重', name: '体重', unit: 'kg' },
    { kind: 'heartRate', mark: '心', name: '心率', unit: '次/分' },
    { kind: 'stress', mark: '压', name: '压力', unit: '' },
    { kind: 'sleep', mark: '睡', name: '睡眠', unit: '小时' },
    { kind: 'pai', mark: 'P', name: 'PAI', unit: '' },
    { kind: 'steps', mark: '步', name: '步数', unit: '步' },
  ];
  const marks: Record<string, string> = { height: '高', weight: '重', heartRate: '心', stress: '压', sleep: '睡', pai: 'P', steps: '步', exercise: '动', meal: '食' };
  function format(kind: string, value: number) {
    if (kind === 'height') return `${value} cm`;
    if (kind === 'weight') return `${value} kg`;
    if (kind === 'heartRate') return `${value} 次/分`;
    if (kind === 'sleep') return `${value} 小时`;
    if (kind === 'exercise') return `${value} 分钟`;
    if (kind === 'meal') return `${value} 餐`;
    if (kind === 'steps') return `${value} 步`;
    return String(value);
  }
  const currentHeight = latestHealthByKind(records, 'height');
  const currentWeight = latestHealthByKind(records, 'weight');
  const [editingBody, setEditingBody] = useState(false);
  function submitBody(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const height = Number(form.get('height')); const weight = Number(form.get('weight')); if (!(height > 0) || !(weight > 0)) return; onSaveBody(height, weight); }
  return <div className="page feature-page"><section className="health-hero"><span>本机健康记录</span><strong>{records.length || '—'}</strong><div><h2>{records.length ? summarizeHealth(records) : '还没有健康记录'}</h2><p>身高、体重、心率、压力、睡眠和 PAI 会给本机管家做分析。不是诊断。可导入 Gadgetbridge 数据库或 ZIP（含 v6 睡眠）。压力和 PAI 多数手环不会写入健康平台，可手动补。</p></div></section><section className="feature-section"><div className="feature-title"><div><span>BODY PROFILE</span><h2>身体资料</h2></div></div>{currentHeight != null && currentWeight != null && !editingBody ? <div className="body-profile-summary"><strong>{currentHeight} cm</strong><strong>{currentWeight} kg</strong><button type="button" onClick={() => setEditingBody(true)}>修改</button></div> : <form className="body-profile-form" onSubmit={(event) => { submitBody(event); setEditingBody(false); }}><label>身高（cm）<input required name="height" type="number" min="50" max="250" step="0.1" defaultValue={currentHeight ?? ''} /></label><label>体重（kg）<input required name="weight" type="number" min="10" max="400" step="0.1" defaultValue={currentWeight ?? ''} /></label><button className="save" type="submit">保存身高体重</button></form>}</section><section className="feature-section"><div className="feature-title"><div><span>HEALTH</span><h2>健康项目</h2></div><div><button type="button" onClick={onImport}>连接 Gadgetbridge</button><button onClick={onAdd}>＋ 添加</button></div></div><div className="health-grid">{cards.map((card) => { const value = latestHealthByKind(records, card.kind); return <article key={card.kind}><span>{card.mark}</span><div><strong>{card.name}</strong><small>最近一次</small></div><b>{value == null ? '待记录' : format(card.kind, value)}</b></article>; })}</div></section><section className="feature-section"><div className="feature-title"><div><span>HISTORY</span><h2>最近记录</h2></div></div><div className="plain-list">{records.map((item) => <article key={item.id}><span>{marks[item.kind] || '健'}</span><div><strong>{item.note}</strong><small>{format(item.kind, item.value)}</small></div></article>)}</div></section><section className="howto"><h3>Gadgetbridge 直连导入</h3><ol><li>在 Gadgetbridge 开启自动导出数据库或完整 ZIP</li><li>本应用点 <b>连接 Gadgetbridge</b>，选择同一个数据库或 ZIP 文件并授权读取</li><li>以后每次导出成功后，本应用会自动读取步数、压力、PAI、心率和 v6 睡眠</li></ol><p>这是直接解析 Gadgetbridge 导出的 SQLite 数据库或完整 ZIP（含 Xiaomi v6 睡眠），不经过 Health Connect。</p></section></div>;
}

function parseTravelText(text: string): TravelItem | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const train = raw.match(/([GDCZTK]\d{1,5})次?/);
  const flight = raw.match(/\b([A-Z]{2}\d{3,4})\b/i);
  const resolvedKind: TravelItem['kind'] | null = train ? 'train' : (flight && /航班|起飞|登机|机场/.test(raw) ? 'flight' : null);
  if (!resolvedKind) return null;
  const number = (train?.[1] || flight?.[1] || '').toUpperCase();
  const route = raw.match(/([\u4e00-\u9fa5]{2,12}?)(?:站|机场)?\s*[-—至到]\s*([\u4e00-\u9fa5]{2,12}?)(?:站|机场)?/);
  const dateMatch = raw.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  const year = dateMatch?.[1] || TODAY.slice(0, 4);
  const month = dateMatch ? String(dateMatch[2]).padStart(2, '0') : TODAY.slice(5, 7);
  const day = dateMatch ? String(dateMatch[3]).padStart(2, '0') : TODAY.slice(8, 10);
  const times = [...raw.matchAll(/(\d{1,2}:\d{2})/g)].map((item) => item[1]);
  const date = `${year}-${month}-${day}`;
  const seat = raw.match(/(\d{1,2}车\s*\d{1,3}[A-F]?)/)?.[1] || '待分配';
  const terminal = raw.match(/检票口\s*([A-Z]?\d{1,3}[A-Z]?)/)?.[1] || raw.match(/(?:航站楼|登机口)\s*([A-Z]?\d{1,2}[A-Z]?)/)?.[1] || '待确认';
  return { id: uid('travel'), kind: resolvedKind, number, from: route?.[1] || '待确认', to: route?.[2] || '待确认', departAt: `${date}T${times[0] || '08:00'}`, arriveAt: `${date}T${times[1] || times[0] || '12:00'}`, seat, terminal, status: 'upcoming', source: 'import', verified: false };
}

function TravelPanel({ items, onSync, onAdd, onDelete }: { items: TravelItem[]; onSync: () => void; onAdd: () => void; onDelete: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => a.departAt.localeCompare(b.departAt));
  const next = sorted.find((item) => item.status !== 'completed');
  const [paste, setPaste] = useState('');
  function time(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value.replace('T', ' ') : new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date); }
  function submitPaste(event: FormEvent) {
    event.preventDefault();
    const trip = parseTravelText(paste);
    if (!trip) return;
    window.dispatchEvent(new CustomEvent('self-agent:travel-updated', { detail: [trip] }));
    setPaste('');
  }
  return <div className="page feature-page travel-page">
    <section className="travel-hero"><div><span>NEXT TRIP</span><h2>{next ? `${next.from} → ${next.to}` : '暂无后续行程'}</h2><p>{next ? `${next.number} · ${time(next.departAt)}` : '可以粘贴 12306/航司短信，或授权通知读取。'}</p></div><b>{next?.kind === 'flight' ? '航' : '铁'}</b></section>
    <section className="travel-actions"><button onClick={onSync}><span>↻</span><div><strong>读取通知里的行程</strong><small>12306、航旅纵横、短信通知</small></div></button><button onClick={onAdd}><span>＋</span><div><strong>手动添加</strong><small>补充车次、航班和座位</small></div></button></section>
    <form className="howto" onSubmit={submitPaste}><h3>粘贴 12306 / 航班短信</h3><textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={3} placeholder="例如：您已购8月29日G123次北京南站-上海虹桥站" style={{ width: '100%', minHeight: 72, border: '1px solid var(--line)', borderRadius: 10, padding: 8 }} /><button className="save" type="submit" style={{ marginTop: 8 }}>识别并保存</button></form>
    <section className="feature-section"><div className="feature-title"><div><span>ITINERARY</span><h2>火车与航班</h2></div><small>{sorted.length} 段</small></div><div className="trip-list">{sorted.length ? sorted.map((item) => <article key={item.id} className={item.status}><header><span>{item.kind === 'flight' ? '航班' : '火车'} · {item.number}</span><b>{item.source === 'notification' ? '通知识别' : item.source === 'manual' ? '手动添加' : '粘贴识别'}</b></header><div className="trip-route"><div><strong>{item.from}</strong><small>{time(item.departAt)}</small></div><i>→</i><div><strong>{item.to}</strong><small>{time(item.arriveAt)}</small></div></div><footer><span>{item.seat}</span><span>{item.terminal}</span><span>{item.source === 'manual' ? '手动' : item.source === 'notification' ? '通知' : '导入'}</span></footer><div className="trip-ops"><button type="button" onClick={() => onDelete(item.id)}>删除</button></div></article>) : <div className="list-empty">还没有行程。粘贴短信或打开通知使用权后等待识别。</div>}</div></section>
    <section className="howto"><h3>为什么没有直接登录 12306</h3><p>铁路 12306 没有对第三方开放「我的车票」官方接口。不能用破解或模拟登录去拉你的订单。公开余票查询也不是你的行程。</p><p>航班动态可用航旅纵横、飞常准等官方渠道；本 App 先识别你已经收到的出票通知。</p></section>
  </div>;
}

function DataPanel({ data }: { data: AppData }) {
  const month = data.transactions.filter((item) => item.createdAt.startsWith(MONTH) && item.currency === 'CNY');
  const income = month.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = month.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const todayItems = data.schedules.filter((item) => item.date === TODAY);
  const healthLine = summarizeHealth(data.healthRecords);
  const hasEnough = month.length + todayItems.length + data.healthRecords.length > 0;
  return <div className="page feature-page"><section className="data-hero"><span>本机摘要</span><h2>{hasEnough ? '已保存记录' : '暂无结论'}</h2><p>{hasEnough ? '只汇总你确认保存过的日程、账本和健康记录，没有预测分数。' : '记录几天真实数据后，这里才会出现摘要。'}</p></section><section className="feature-section"><div className="feature-title"><div><span>SUMMARY</span><h2>统一摘要</h2></div></div><div className="data-summary"><article><span>健</span><div><strong>健康</strong><small>{data.healthRecords.length ? healthLine : '还没有健康记录'}</small></div><b>{data.healthRecords.length ? `${data.healthRecords.length} 条` : '—'}</b></article><article><span>财</span><div><strong>财务</strong><small>{month.length ? `收入 ¥${money(income)} · 支出 ¥${money(expense)}` : '本月还没有流水'}</small></div><b>{month.length ? `${month.length} 笔` : '—'}</b></article><article><span>行</span><div><strong>行动</strong><small>今日 {todayItems.length} 项日程</small></div><b>{todayItems.length ? `${todayItems.filter((item) => item.done).length}/${todayItems.length}` : '—'}</b></article></div></section></div>;
}

function describeButlerAction(action: ButlerAction, memories: MemoryItem[]): { title: string; detail: string } {
  const memoryTitle = (id: string) => memories.find((item) => item.id === id)?.title || id;
  if (action.type === 'create_schedule') return { title: '安排日程', detail: `${action.payload.date} ${action.payload.time} · ${action.payload.title}` };
  if (action.type === 'create_expense') return { title: '记一笔账', detail: `${action.payload.merchant} · ${action.payload.amount}` };
  if (action.type === 'create_travel') return { title: '添加行程', detail: `${action.payload.travelKind === 'flight' ? '航班' : '火车'} ${action.payload.number} ${action.payload.from} → ${action.payload.to} ${action.payload.date} ${action.payload.departTime}` };
  if (action.type === 'create_health') return { title: '记录健康', detail: `${HEALTH_METRIC_LABELS[action.payload.metric]} ${action.payload.value}` };
  if (action.type === 'add_memory') return { title: '新增记忆', detail: action.payload.title };
  if (action.type === 'update_memory') return { title: '更新记忆', detail: action.payload.title || memoryTitle(action.payload.id) };
  if (action.type === 'pause_memory') return { title: '暂停记忆', detail: memoryTitle(action.payload.id) };
  return { title: '删除记忆', detail: memoryTitle(action.payload.id) };
}

function formatHealthAnswer(briefing: { rangeLabel: string; evidence: string; missing: string[]; disclaimer: string }, extra = '') {
  const missing = briefing.missing.length ? briefing.missing.join('、') : '无';
  return [extra, `数据范围：${briefing.rangeLabel}`, `证据：${briefing.evidence}`, `缺失指标：${missing}`, briefing.disclaimer].filter(Boolean).join('\n');
}

function ButlerPanel({ data, ai, onConfirmAction }: { data: AppData; ai: AiConfig; onConfirmAction: (action: ButlerAction) => void }) {
  const connected = Boolean(ai.baseUrl && ai.apiKey);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkState, setLinkState] = useState<'unconfigured' | 'ready' | 'busy' | 'offline'>(connected ? 'ready' : 'unconfigured');
  const [pending, setPending] = useState<ButlerAction[]>([]);
  const briefing = buildHealthBriefing(data.healthRecords, data.privacy.health);
  const scopes = describeButlerDataScope(data.privacy);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([{ role: 'bot', text: connected ? '已连接你配置的 AI 接口。我只会发送允许的摘要，不会读取密码。写操作都要你确认。' : '尚未配置 AI 接口时，我使用本机规则摘要。密码永远不会进入请求。' }]);
  function localAnswer(text: string) {
    if (/密码|验证码|私钥|助记词/.test(text)) return '密码库是独立安全域。我不能读取或复述密码、验证码、私钥和助记词。这个问题不会发给 AI。';
    if (/睡眠|疲惫|健康|心率|压力|PAI|身高|体重|步数/.test(text)) {
      if (!data.privacy.health) return formatHealthAnswer(briefing, '健康摘要权限已关闭，不会把健康记录发给 AI。');
      return formatHealthAnswer(briefing, briefing.evidence.startsWith('尚无') ? '还没有足够的健康记录。可在健康页添加或导入手环。' : '以下是本机健康摘要。');
    }
    if (/财务|花|钱|结余/.test(text)) {
      if (!data.privacy.finance) return '财务摘要权限已关闭。你可以在隐私与权限中重新开启。';
      const month = data.transactions.filter((item) => item.createdAt.startsWith(MONTH) && item.currency === 'CNY');
      const income = month.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
      const expense = month.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
      return `本月已确认收入 ${money(income)} 元、支出 ${money(expense)} 元，结余 ${money(income - expense)} 元。未读取订单号或密码。财务不是投资建议。`;
    }
    if (/记忆/.test(text)) {
      const active = data.memories.filter((item) => item.active);
      return active.length ? `当前使用中的记忆：${active.map((item) => item.title).join('、')}。修改需要确认管家动作。` : '还没有使用中的记忆。可以说出要记住的内容，确认后才会保存。';
    }
    if (!data.privacy.schedule) return '日程摘要权限已关闭。你可以在隐私与权限中重新开启。';
    const open = data.schedules.filter((item) => item.date === TODAY && !item.done);
    return open.length ? `建议先处理“${open[0].title}”，完成后再安排下一项。` : '今天没有未完成日程，可以保留一点空白。';
  }
  async function send(text = input) {
    const value = text.trim(); if (!value || busy) return;
    setInput(''); setBusy(true); setLinkState(connected ? 'busy' : 'unconfigured');
    setMessages((current) => [...current, { role: 'user', text: value }]);
    if (/密码|验证码|私钥|助记词/.test(value)) {
      setMessages((current) => [...current, { role: 'bot', text: localAnswer(value) }]);
      setBusy(false); setLinkState(connected ? 'ready' : 'unconfigured');
      return;
    }
    let reply = localAnswer(value);
    let actions: ButlerAction[] = [];
    if (connected) {
      try {
        const response = await fetch(`${ai.baseUrl}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` }, body: JSON.stringify({ model: ai.model || 'gpt-4o-mini', messages: [{ role: 'system', content: buildButlerSystemPrompt({ today: TODAY, month: MONTH, privacy: data.privacy, schedules: data.schedules, transactions: data.transactions, healthRecords: data.privacy.health ? data.healthRecords : [], memories: data.memories }) }, { role: 'user', content: value }] }) });
        const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
        const parsed = parseButlerModelOutput(payload.choices?.[0]?.message?.content?.trim() || reply);
        reply = parsed.reply;
        actions = parsed.actions;
        if (/健康|心率|睡眠|压力|PAI|身高|体重|步数/.test(value) && !reply.includes('不是诊断')) reply = formatHealthAnswer(briefing, reply);
        setLinkState('ready');
      } catch {
        reply = `${reply}\n\n（AI 接口暂时不可用，以上为本机规则结果）`;
        setLinkState('offline');
      }
    }
    setPending(actions);
    setMessages((current) => [...current, { role: 'bot', text: reply }]);
    setBusy(false);
  }
  const statusLabel = busy || linkState === 'busy' ? '正在连接' : linkState === 'offline' ? '接口不可用，已回退本机规则' : connected ? '已配置，可连接' : '未配置，使用本机规则';
  return <div className="page butler-page">
    <section className="butler-status"><span>AI 连接状态</span><strong>{statusLabel}</strong><small>{connected ? (ai.model || 'gpt-4o-mini') : '不会调用外部接口'}</small></section>
    <section className="butler-scope"><span>当前允许的数据域</span><div>{scopes.map((item) => <b key={item.key} className={item.allowed ? 'on' : 'off'}>{item.label} · {item.allowed ? '开' : '关'}</b>)}</div></section>
    <section className="butler-briefing"><span>健康回答边界</span><p>数据范围：{briefing.rangeLabel}</p><p>缺失指标：{briefing.missing.length ? briefing.missing.join('、') : '无'}</p><p>{briefing.disclaimer}</p></section>
    <div className="butler-quick"><button type="button" onClick={() => send('帮我安排明天上午的日程')}>安排日程</button><button type="button" onClick={() => send('帮我记下今天的健康数据')}>记健康</button><button type="button" onClick={() => send('分析最近的健康记录')}>分析健康</button><button type="button" onClick={() => send('帮我查看并管理记忆')}>管理记忆</button></div>
    <div className="chat-messages">{messages.map((message, index) => <div key={index} className={message.role}>{message.text}</div>)}</div>
    {pending.length > 0 && <div className="butler-pending">{pending.map((action, index) => {
      const card = describeButlerAction(action, data.memories);
      return <article key={`${action.type}-${index}`}>
        <span>待确认草稿</span>
        <h3>{card.title}</h3>
        <p>{card.detail}</p>
        <small>确认后才会写入本机，模型不能直接改数据。</small>
        <div>
          <button type="button" onClick={() => { onConfirmAction(action); setPending((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>确认</button>
          <button type="button" className="ghost" onClick={() => { setPending((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>取消</button>
        </div>
      </article>;
    })}</div>}
    <form className="butler-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={busy ? '正在生成…' : '问问今天的状态…'} /><button disabled={busy}>发送</button></form>
  </div>;
}

function MemoryPanel({ items, onToggle, onDelete }: { items: MemoryItem[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="page feature-page"><section className="feature-heading"><span>MEMORY</span><h2>你决定管家记住什么。</h2><p>记忆可以随时暂停或删除。修改请让管家生成草稿，确认后才会写入。</p></section><div className="memory-list">{items.map((item) => { const memory = normalizeMemory(item); return <article key={item.id} className={!memory.active ? 'inactive' : ''}><header><span>{memory.kind}</span><b>{memory.status}</b></header><h3>{memory.title}</h3><p>{memory.note}</p><dl className="memory-meta"><div><dt>来源</dt><dd>{memory.source || '本机已有记忆'}</dd></div><div><dt>用途</dt><dd>{memory.purpose}</dd></div><div><dt>更新</dt><dd>{memory.updatedAt || '尚未更新'}</dd></div></dl><div><button onClick={() => onToggle(item.id)}>{memory.active ? '暂停使用' : '重新启用'}</button><button className="danger-text" onClick={() => onDelete(item.id)}>删除</button></div></article>; })}</div></div>;
}

function PrivacyPanel({ settings, onToggle }: { settings: PrivacySettings; onToggle: (key: keyof PrivacySettings) => void }) {
  const rows: { key: keyof PrivacySettings; title: string; note: string }[] = [{ key: 'health', title: '健康摘要', note: '身高、体重、心率、压力、睡眠和 PAI' }, { key: 'finance', title: '财务摘要', note: '收入、支出、分类和未来扣款' }, { key: 'schedule', title: '日程与行动', note: '用于排序、提醒与完成情况' }];
  return <div className="page feature-page"><section className="security-hero"><span>当前保护状态</span><h2>本机优先</h2><p>每类摘要可以单独关闭；密码权限永久不开放。</p></section><section className="permission-list">{rows.map((row) => <article key={row.key}><div><strong>{row.title}</strong><small>{row.note}</small></div><button className={settings[row.key] ? 'on' : ''} onClick={() => onToggle(row.key)} aria-label={`${row.title}权限`}><i /></button></article>)}<article><div><strong>密码与恢复码</strong><small>密码、验证码、私钥、助记词永久禁止</small></div><button disabled aria-label="密码权限永久关闭"><i /></button></article></section><p className="security-copy">当前开关会真实影响本机管家回答时可使用的摘要范围，不只是界面状态。</p></div>;
}

function HowToNative() {
  return (
    <>
      <section className="howto">
        <h3>怎么自动记账</h3>
        <ol>
          <li>打开手机 <b>设置 → 无障碍 / 已安装的应用</b></li>
          <li>打开 <b>Self Agent</b>（和钱迹一样，用来读支付成功页）</li>
          <li>再用搜索打开 <b>通知使用权</b>，也打开 Self Agent</li>
          <li>微信或支付宝付款成功后，会直接弹出通知</li>
          <li>点通知里的 <b>确认入账</b> 即可，点忽略则不记账</li>
        </ol>
      </section>
      <section className="howto">
        <h3>怎么自动记住密码</h3>
        <ol>
          <li>打开手机 <b>设置</b></li>
          <li>搜索“<b>自动填充</b>”</li>
          <li>自动填充服务选 <b>Self Agent</b></li>
          <li>去别的 App 登录，弹出“保存密码？”时点保存</li>
          <li>下次登录选 Self Agent 填充。密码不会进网页和 AI</li>
          <li>Chrome 还要：设置 → 自动填充服务 → 使用其他服务，然后重启 Chrome</li>
          <li>在登录页输入账号密码后点登录，系统应弹出「保存密码？」</li>
        </ol>
      </section>
      <section className="howto">
        <h3>12306 和航班</h3>
        <ol>
          <li>打开通知使用权给 Self Agent</li>
          <li>12306 / 航司短信来了会自动识别</li>
          <li>也可以在行程页粘贴短信</li>
        </ol>
      </section>
    </>
  );
}

function VaultPanel({ items, nativeOn, onReveal }: { items: { id?: string; title: string; usernameHint: string; note?: string }[]; nativeOn: boolean; onReveal?: (id: string) => void }) {
  return <div className="page feature-page"><section className="vault-safe"><span>钥</span><h2>{nativeOn ? 'Keystore 密码库已连接' : '安全密码库入口'}</h2><p>密码明文只在本机 Keystore。点「查看」后需指纹或锁屏验证，不会写入网页存储，也不会进 AI。</p><b>{nativeOn ? '指纹验证后可查看' : '请在 Android App 中查看密码'}</b></section><section className="feature-section"><div className="feature-title"><div><span>METADATA</span><h2>账号目录</h2></div><small>{items.length} 项</small></div><div className="plain-list">{items.map((item) => <article key={item.id || item.title}><span>{item.title.slice(0, 1)}</span><div><strong>{item.title}</strong><small>{item.usernameHint}{item.note ? ` · ${item.note}` : ''}</small></div>{nativeOn && <div className="row-ops"><button type="button" className="edit" onClick={() => onReveal?.(item.id || item.title)}>查看</button></div>}</article>)}</div></section>{nativeOn && <div className="native-actions"><button type="button" onClick={() => (window as Window & { SelfAgentNative?: { openAutofillSettings?: () => void } }).SelfAgentNative?.openAutofillSettings?.()}>打开系统自动填充设置</button></div>}<HowToNative /><section className="vault-warning"><strong>密码不会进入 AI</strong><p>导出和管家问答只有账号名。查看明文必须通过指纹或锁屏验证，并只显示在系统弹窗里。</p></section></div>;
}

type FinancePanelProps = { data: AppData; currency: Currency; selectedAccountId: string | null; selectedHoldingId: string | null; onCurrency: (currency: Currency) => void; onSelectAccount: (id: string) => void; onSelectHolding: (id: string) => void; onBackAccount: () => void; onBackHolding: () => void; onNewTransaction: () => void; onEditTransaction: (id: string) => void; onDeleteTransaction: (id: string) => void; onNewAccount: () => void; onEditAccount: (id: string) => void; onNewHolding: () => void; onEditHolding: (id: string) => void; onNewRecurring: () => void; onEditRecurring: (id: string) => void; onDeleteRecurring: (id: string) => void; onRunRecurring: (id: string) => void; onToggleRecurring: (id: string) => void; onSettleReimbursement: (id: string) => void; onSettleAccount: (id: string) => void; onNewRate: () => void; onEditRate: (currency: Exclude<Currency, 'CNY'>) => void; onDeleteRate: (currency: Exclude<Currency, 'CNY'>) => void; onRefreshQuotes: () => void };

function FinancePanel({ data, currency, selectedAccountId, selectedHoldingId, onCurrency, onSelectAccount, onSelectHolding, onBackAccount, onBackHolding, onNewTransaction, onEditTransaction, onDeleteTransaction, onNewAccount, onEditAccount, onNewHolding, onEditHolding, onNewRecurring, onEditRecurring, onDeleteRecurring, onRunRecurring, onToggleRecurring, onSettleReimbursement, onSettleAccount, onNewRate, onEditRate, onDeleteRate, onRefreshQuotes }: FinancePanelProps) {
  const selectedHolding = selectedHoldingId ? data.investments.find((item) => item.id === selectedHoldingId) : undefined;
  if (selectedHolding) return <HoldingDetail holding={selectedHolding} account={data.accounts.find((item) => item.id === selectedHolding.accountId)} onBack={onBackHolding} onEdit={() => onEditHolding(selectedHolding.id)} />;
  const selectedAccount = selectedAccountId ? data.accounts.find((item) => item.id === selectedAccountId) : undefined;
  if (selectedAccount) {
    const accountItems = data.transactions.filter((item) => item.accountId === selectedAccount.id || item.targetAccountId === selectedAccount.id);
    const accountHoldings = data.investments.filter((item) => item.accountId === selectedAccount.id);
    const income = accountItems.filter((item) => item.kind === 'income' && item.accountId === selectedAccount.id).reduce((sum, item) => sum + item.accountAmount, 0);
    const expense = accountItems.filter((item) => item.kind === 'expense' && item.accountId === selectedAccount.id).reduce((sum, item) => sum + item.accountAmount, 0);
    return <div className="page finance-page account-detail-page"><button className="inline-back" onClick={onBackAccount}>‹ 返回全部账户</button><section className={`account-hero ${selectedAccount.tone}`}><span>{roleLabel(selectedAccount.type)} · {selectedAccount.currency}</span><h2>{selectedAccount.name}</h2><strong>{isDebtRole(accountRole(selectedAccount.type)) ? '欠 ' : ''}{currencyMark(selectedAccount.currency)} {money(normalizeAccountBalance(selectedAccount.type, selectedAccount.balance))}</strong><div className="account-hero-ops"><button type="button" onClick={() => onEditAccount(selectedAccount.id)}>编辑</button>{accountRole(selectedAccount.type) === 'receivable' && selectedAccount.balance > 0 && <button type="button" onClick={() => onSettleAccount(selectedAccount.id)}>收回</button>}{isDebtRole(accountRole(selectedAccount.type)) && selectedAccount.balance > 0 && <button type="button" onClick={() => onSettleAccount(selectedAccount.id)}>还款</button>}</div></section><section className="account-stats"><article><span>流入</span><strong>+{currencyMark(selectedAccount.currency)}{money(income)}</strong></article><article><span>流出</span><strong>−{currencyMark(selectedAccount.currency)}{money(expense)}</strong></article><article><span>账目</span><strong>{accountItems.length} 笔</strong></article></section>{selectedAccount.type === '理财账户' && <section className="section-block"><div className="section-title"><div><span>HOLDINGS</span><h2>该账户持仓</h2></div><button onClick={onNewHolding}>＋ 添加产品</button></div><InvestmentList items={accountHoldings} onSelect={onSelectHolding} /></section>}<section className="section-block"><div className="section-title"><div><span>ACCOUNT LEDGER</span><h2>该账户全部账单</h2></div><button onClick={onNewTransaction}>＋ 记一笔</button></div><TransactionList items={accountItems} accounts={data.accounts} onEdit={onEditTransaction} onDelete={onDeleteTransaction} onSettle={onSettleReimbursement} /></section></div>;
  }
  const monthItems = data.transactions.filter((item) => item.currency === currency && item.createdAt.startsWith(MONTH));
  const monthIncome = monthItems.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const monthExpense = monthItems.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const todayExpense = monthItems.filter((item) => item.kind === 'expense' && item.createdAt.startsWith(TODAY)).reduce((sum, item) => sum + item.amount, 0);
  const reimburse = monthItems.filter((item) => item.kind === 'expense' && item.reimbursable && !item.reimbursed).reduce((sum, item) => sum + item.amount, 0);
  const currentDay = Number(TODAY.slice(-2));
  const chartDays = Array.from({ length: Math.min(6, currentDay) }, (_, index) => Math.max(1, currentDay - 5) + index).map((day) => ({ day, amount: monthItems.filter((item) => item.kind === 'expense' && Number(item.createdAt.slice(8, 10)) === day).reduce((sum, item) => sum + item.amount, 0) }));
  const maxDay = Math.max(...chartDays.map((item) => item.amount), 1);
  const mark = currencyMark(currency);
  const wealth = wealthTotals(data.accounts, data.transactions);
  const cnyWealth = cnyWealthTotal(data.accounts, data.transactions, data.exchangeRates);
  return <div className="page finance-page">
    <section className="finance-toolbar"><div><span>{Number(MONTH.slice(0, 4))}年{Number(MONTH.slice(5, 7))}月</span><h2>财务</h2></div><select aria-label="月度收支币种" value={currency} onChange={(event) => onCurrency(event.target.value as Currency)}>{currencies.map((item) => <option key={item}>{item}</option>)}</select></section>
    <section className="asset-summary"><span>NET WORTH · CNY</span><h2>净资产（统一折算人民币）</h2><div className="asset-lines"><strong>¥ {money(cnyWealth.convertedCny)}</strong></div>{cnyWealth.unresolved.length > 0 && <p>待补汇率，暂未计入：{cnyWealth.unresolved.map((item) => `${item.currency} ${money(item.amount)}`).join(' · ')}</p>}{wealth.map((line) => <p key={`${line.currency}-break`}>{line.currency} 资产 {formatAssetAmount(line.currency, line.assets)} · 债务 · 应收 {formatAssetAmount(line.currency, line.receivable)} · 债务 · 应付 {formatAssetAmount(line.currency, line.payable)}</p>)}<p>{data.accounts.length ? '外币按每日参考汇率折算人民币；缺失汇率的币种不伪造总额。债务里有应收和应付，报销不是独立账户。' : '还没有账户，净资产为 ¥ 0.00。'}</p>{!data.accounts.length && <button type="button" onClick={onNewAccount}>添加第一个账户</button>}</section>
    <section className="section-block"><div className="section-title"><div><span>EXCHANGE RATES</span><h2>人民币汇率</h2></div><div className="section-actions"><button type="button" onClick={onRefreshQuotes}>每日更新</button></div></div>{data.exchangeRates.length ? <div className="plain-list">{data.exchangeRates.map((rate) => <article key={rate.currency}><span>{rate.currency}</span><div><strong>1 {rate.currency} = ¥ {money(rate.cnyRate)}</strong><small>每日参考 · Frankfurter · 适用 {rate.asOf} · 更新 {rate.updatedAt.replace('T', ' ')}</small></div></article>)}</div> : <div className="list-empty">还没有网络汇率。点「每日更新」，或等每天 18:00 自动拉取。</div>}<p className="automation-note">汇率来自 Frankfurter（欧洲央行公开日频），持仓收盘价来自 Stooq。每天 18:00 更新一次，只改估值，不改流水。</p></section>
    <section className="monthly-summary"><article><span>本月收入</span><strong className="income">+{mark}{money(monthIncome)}</strong></article><article><span>本月支出</span><strong>−{mark}{money(monthExpense)}</strong></article><article><span>本月结余</span><strong className={monthIncome - monthExpense >= 0 ? 'income' : ''}>{monthIncome - monthExpense >= 0 ? '+' : '−'}{mark}{money(Math.abs(monthIncome - monthExpense))}</strong></article></section>
    <section className="daily-card"><header><div><span>DAILY SPEND</span><h3>每日支出</h3></div><div><small>今天</small><strong>{mark}{money(todayExpense)}</strong></div></header><div className="spend-chart">{chartDays.map((item) => <div key={item.day}><span><i style={{ height: `${Math.max(5, item.amount / maxDay * 100)}%` }} /></span><small>{item.day}日</small></div>)}</div><footer><span>待报销</span><strong>{mark}{money(reimburse)}</strong></footer></section>
    <button className="bookkeeping-button" onClick={onNewTransaction}><span>＋</span><div><strong>记一笔</strong><small>选择账户、币种与报销状态</small></div><b>›</b></button>
    <section className="section-block account-section"><div className="section-title"><div><span>ACCOUNTS</span><h2>我的账户</h2></div><button onClick={onNewAccount}>＋ 添加账户</button></div>{data.accounts.length ? <div className="account-grid">{data.accounts.map((account) => <article className={account.tone} key={account.id} role="button" tabIndex={0} onClick={() => onSelectAccount(account.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectAccount(account.id); }}><span>{roleLabel(account.type)} · {account.currency}</span><button className="account-edit-button" onClick={(event) => { event.stopPropagation(); onEditAccount(account.id); }}>编辑</button><h3>{account.name}</h3><strong>{isDebtRole(accountRole(account.type)) ? '欠 ' : ''}{currencyMark(account.currency)} {money(normalizeAccountBalance(account.type, account.balance))}</strong><small className="account-open-hint">查看账单 ›</small></article>)}</div> : <div className="list-empty">还没有账户，净资产为 0</div>}</section>
    <section className="section-block investment-section"><div className="section-title"><div><span>INVESTMENTS · {currency}</span><h2>理财与投资</h2></div><button onClick={onNewHolding}>＋ 添加产品</button></div><div className="investment-toolbar"><span>每天 18:00 用收盘价重算收益，账户余额按持仓计算</span></div><InvestmentList items={data.investments.filter((item) => item.currency === currency)} onSelect={onSelectHolding} /><p className="automation-note">行情只覆盖今日价格点。历史流水和成本不变。</p></section>
    <section className="section-block"><div className="section-title"><div><span>MONTHLY BILLS</span><h2>每月账单</h2></div><button onClick={onNewRecurring}>＋ 添加账单</button></div><div className="recurring-list">{data.recurringRules.length ? data.recurringRules.map((rule) => { const future = rule.dueDay > Number(TODAY.slice(-2)); return <article key={rule.id} className={!rule.enabled ? 'disabled' : ''}><span className="rule-icon">{rule.kind === 'subscription' ? '订' : '还'}</span><div><strong>{rule.name}</strong><small>每月 {rule.dueDay} 日 · {data.accounts.find((account) => account.id === rule.accountId)?.name || '账户待补充'}</small><button disabled={!rule.enabled || rule.lastRunPeriod === MONTH || future} onClick={() => onRunRecurring(rule.id)}>{rule.lastRunPeriod === MONTH ? '本月已确认' : !rule.enabled ? '已暂停' : future ? `${rule.dueDay}日到期` : rule.kind === 'subscription' ? '确认已扣款' : '确认已还款'}</button></div><b>{currencyMark(rule.currency)}{money(rule.amount)}</b><div className="row-ops"><button type="button" className="edit" onClick={() => onEditRecurring(rule.id)}>编辑</button><button type="button" className="del" onClick={() => onDeleteRecurring(rule.id)}>删除</button></div></article>; }) : <div className="list-empty">还没有每月账单</div>}</div><p className="automation-note">只做本机到期提醒，不会替你扣款。你确认实际发生后，才会写入账本并改变余额。每条账单都可以单独编辑或删除。</p></section>
    <section className="section-block"><div className="section-title"><div><span>LEDGER · {currency}</span><h2>本月流水</h2></div></div><TransactionList items={monthItems} accounts={data.accounts} onEdit={onEditTransaction} onDelete={onDeleteTransaction} onSettle={onSettleReimbursement} /></section>
  </div>;
}

function InvestmentList({ items, onSelect }: { items: InvestmentHolding[]; onSelect: (id: string) => void }) {
  if (!items.length) return <div className="list-empty">该币种还没有理财产品</div>;
  return <div className="investment-list">{items.map((item) => { const profit = investmentProfit(item); const rate = item.averageCost > 0 ? profit / (item.quantity * item.averageCost) * 100 : 0; return <button key={item.id} onClick={() => onSelect(item.id)}><span className={`asset-kind ${item.kind}`}>{item.kind === 'fund' ? '基' : item.kind === 'stock' ? '股' : item.kind === 'meme' ? 'M' : '币'}</span><div><strong>{item.name}</strong><small>{item.code || `${item.network} · ${item.contract.slice(0, 8)}…`} · {item.quoteStatus === 'live' ? '实时源' : item.quoteStatus === 'manual' ? '手动更新' : '示例'}</small></div><div><b>{currencyMark(item.currency)}{money(investmentValue(item))}</b><em className={profit >= 0 ? 'positive' : 'negative'}>{profit >= 0 ? '+' : '−'}{currencyMark(item.currency)}{money(Math.abs(profit))} · {rate.toFixed(2)}%</em></div><i>›</i></button>; })}</div>;
}

function HoldingDetail({ holding, account, onBack, onEdit }: { holding: InvestmentHolding; account?: Account; onBack: () => void; onEdit: () => void }) {
  const profit = investmentProfit(holding);
  const cost = holding.quantity * holding.averageCost;
  const rate = cost ? profit / cost * 100 : 0;
  const values = holding.history.map((item) => item.price);
  const min = Math.min(...values, holding.currentPrice);
  const max = Math.max(...values, holding.currentPrice);
  const spread = Math.max(max - min, Math.abs(max) * .02, .00000001);
  const points = holding.history.map((item, index) => ({ ...item, x: holding.history.length === 1 ? 50 : index / (holding.history.length - 1) * 100, y: 88 - (item.price - min) / spread * 70 }));
  const polygon = points.map((point) => `${point.x}% ${point.y}%`).join(', ');
  return <div className="page finance-page holding-detail"><button className="inline-back" onClick={onBack}>‹ 返回持仓</button><section className="holding-heading"><div><span>{holding.kind === 'fund' ? '基金 / ETF' : holding.kind === 'stock' ? '股票' : holding.kind === 'meme' ? 'Meme 币' : '虚拟货币'} · {holding.quoteStatus === 'live' ? '行情已连接' : holding.quoteStatus === 'manual' ? '手动价格' : '示例行情'}</span><h2>{holding.name}</h2><p>{holding.code}{holding.contract && ` · ${holding.network} · ${holding.contract.slice(0, 8)}…${holding.contract.slice(-6)}`}</p></div><button onClick={onEdit}>更新</button></section><section className="holding-value"><span>当前市值</span><h3>{currencyMark(holding.currency)} {money(investmentValue(holding))}</h3><strong className={profit >= 0 ? 'positive' : 'negative'}>{profit >= 0 ? '+' : '−'}{currencyMark(holding.currency)}{money(Math.abs(profit))}（{rate.toFixed(2)}%）</strong><small>{holding.quantity.toLocaleString('zh-CN')} 份/枚 · 成本 {currencyMark(holding.currency)}{holding.averageCost.toLocaleString('zh-CN')} · {account?.name}</small></section><section className="return-chart-card"><header><div><span>RETURN CURVE</span><h3>单品收益曲线</h3></div><small>最近 {holding.history.length} 个价格点</small></header><div className="return-chart"><div className="return-area" style={{ clipPath: `polygon(0 100%, ${polygon}, 100% 100%)` }} />{points.map((point) => <i key={`${point.date}-${point.price}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}</div><footer><span>{holding.history[0]?.date ?? '—'}</span><span>{holding.history.at(-1)?.date ?? '—'}</span></footer></section><section className="holding-facts"><article><span>当前价</span><strong>{currencyMark(holding.currency)}{holding.currentPrice.toLocaleString('zh-CN')}</strong></article><article><span>总成本</span><strong>{currencyMark(holding.currency)}{money(cost)}</strong></article><article><span>最近更新</span><strong>{holding.updatedAt}</strong></article></section><p className="market-disclaimer">收益由你保存或行情服务返回的价格计算，不代表交易所结算值；合约资产请核对网络和合约地址。</p></div>;
}

function TransactionList({ items, accounts, onEdit, onDelete, onSettle }: { items: Transaction[]; accounts: Account[]; onEdit: (id: string) => void; onDelete: (id: string) => void; onSettle?: (id: string) => void }) {
  if (!items.length) return <div className="list-empty">还没有流水</div>;
  return <div className="transaction-list">{items.map((item) => <article key={item.id}><span className={`transaction-icon ${item.kind}`}>{item.kind === 'income' ? '入' : item.kind === 'transfer' ? '转' : item.category.slice(0, 1)}</span><div><strong>{item.merchant}{item.reimbursable && <em>{item.reimbursed ? '已报销' : '待报销'}</em>}</strong><small>{item.category} · {accounts.find((account) => account.id === item.accountId)?.name} · {item.source}</small></div><b className={item.kind}>{item.kind === 'income' ? '+' : item.kind === 'transfer' ? '↔' : '−'}{currencyMark(item.currency)}{money(item.amount)}</b><div className="row-ops">{item.reimbursable && !item.reimbursed && onSettle && <button type="button" className="edit" onClick={() => onSettle(item.id)}>入账</button>}<button type="button" className="edit" onClick={() => onEdit(item.id)}>编辑</button><button type="button" className="del" onClick={() => onDelete(item.id)}>删除</button></div></article>)}</div>;
}
