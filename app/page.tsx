'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getConvertedNetWorth, getDailySpend, getMonthlyReport, getNetWorth, getOutstandingReimbursements, hasOutstandingReimbursementsForAccount, transactionsInPeriod } from './finance-query';
import { migrateToSchemaV4, createSchemaV4MigrationBackup, applySchemaV4Migration, SCHEMA_V3_BACKUP_KEY } from './finance-schema';
import { HomePage } from './components/daily/HomePage';
import { homeHasAuthoritativeData, homeHasFinanceData, schedulesOnDate } from './components/daily/home';
import { SchedulePage } from './components/daily/SchedulePage';
import { RecordsPage } from './components/daily/RecordsPage';
import { AppHeader } from './components/ui/AppHeader';
import { AppShell } from './components/ui/AppShell';
import { BottomNav } from './components/ui/BottomNav';
import { ProfilePage } from './components/mine/ProfilePage';
import { LifePage } from './components/mine/LifePage';
import { HealthPage } from './components/mine/surfaces/HealthPage';
import { TravelPage } from './components/mine/surfaces/TravelPage';
import { PrivacyPage } from './components/mine/surfaces/PrivacyPage';
import { MemoryPage } from './components/mine/surfaces/MemoryPage';
import { VaultPage } from './components/mine/surfaces/VaultPage';
import { ButlerPage } from './components/mine/surfaces/ButlerPage';
import { AuditPage } from './components/mine/surfaces/AuditPage';
import { DataPage } from './components/mine/surfaces/DataPage';
import { FinancePage, TransactionList } from './components/finance/FinancePage';
import { hideMoney } from './components/finance/format';
import { primaryNavActiveId } from './components/ui/nav';
import { accountRole, applyDailyFxRates, applyDailyPriceQuotes, applyInboxLifecycle, AI_CONFIG_EVENT, AI_CONFIG_STORAGE_KEY, AI_REPLY_EVENT, AUDIT_OUTCOMES, auditOutcomeLabel, auditReasonLabel, buildButlerSystemPrompt, buildHealthBriefing, buildAiSendPreview, canUndoInboxConfirm, cnyWealthTotal, confirmByokHost, classifyAiProviderError, interpretAiConnectionTest, consumeCallBudget, createCallBudget, defaultCashId, describeButlerDataScope, detectLegacyDemoData, dialogShouldDismiss, dismissPermissionOnboarding, filterAuditLog, generateRecurringDrafts, healthRecordsFromSnapshots, inboxConfidenceLabel, inboxConfirmBlockReason, inboxItemFromAiTool, inboxItemFromButlerAction, inboxItemFromNaturalCapture, inboxItemFromPayment, inboxItemFromTravelNotice, inboxSourceLabel, ledgerIdempotencyKeyForInboxItem, INBOX_ACTION_LABELS, isBackupPayload, sanitizeBackupVaultItems, isDebtRole, latestHealthByKind, loadBrowserAiConfig, localDateKey, markPermissionSettingsOpened, migrateAuditLog, migrateInboxStore, migrateLegacyAiLocalStorage, migratePrivacySettings, normalizeAccountBalance, normalizeMemory, normalizePermissionOnboarding, parseAiProviderResponse, parseButlerModelOutput, parseCapabilityStatus, parseNaturalCapture, pendingInboxItems, persistBrowserAiConfig, persistJson, permissionOnboardingProgress, planAccountSettlement, planInvestmentMigrations, confirmInvestmentMigration, prepareOutboundAiPayload, reconcileRecurringConfirmations, releaseRecurringConfirmation, resolveInboxFinanceConfirmation, resolvePaymentAccountId, shouldShowPermissionOnboarding, summarizeHealth, TOAST_ARIA_LIVE, updateInboxItemPayload, upsertByExternalKey, validateByokTarget, ACCOUNT_TYPES, buildReimbursementSettlement, canDeleteAccount, FINANCE_TABS, financeTransactionFields, transactionFormPhases, previewPostedImpact, investmentAccountSnapshot, normalizeFinanceRecords, postBalanceAdjustment, postFinanceTransaction, refreshHoldingsValuation, reimbursementOutstandingAmount, removePostedTransaction, settlePostedReimbursement, resolveTransferAmounts, type AuditEntry, type ButlerAction, type CapabilityStatusSnapshot, type HealthMetric, type InboxItem, type InboxLifecycleEvent, type InboxSource, type PermissionCardId, type PermissionOnboardingState, type TravelKind } from './product-logic';

type Tab = 'home' | 'schedule' | 'capture' | 'finance' | 'profile' | 'life' | 'health' | 'travel' | 'data' | 'butler' | 'privacy' | 'memory' | 'vault' | 'audit';
type ScheduleColor = 'blue' | 'green' | 'orange';
type TransactionKind = 'expense' | 'income' | 'transfer' | 'adjustment' | 'settlement';
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

type Account = { id: string; name: string; type: string; balance: number; currency: Currency; tone: 'forest' | 'clay' | 'ink'; openingBalance?: number };
type LedgerPosting = { accountId: string; amount: number; currency: string };
type Transaction = { id: string; kind: TransactionKind; amount: number; accountAmount: number; currency: Currency; merchant: string; category: string; accountId: string; targetAccountId?: string; targetAmount?: number; targetCurrency?: Currency; exchangeRate?: number; source: string; reimbursable: boolean; reimburseAccountId?: string; reimbursed?: boolean; reimbursementForId?: string; reimbursementTransactionId?: string; recurringRuleId?: string; createdAt: string; occurredAt?: string; occurredAtEstimated?: boolean; postings?: LedgerPosting[]; idempotencyKey?: string; status?: 'draft' | 'confirmed' | 'reversed' | 'superseded'; reversesId?: string; reversedBy?: string };
type RecurringRule = { id: string; name: string; kind: 'subscription' | 'credit-card'; amount: number; currency: Currency; accountId: string; targetAccountId?: string; dueDay: number; enabled: boolean; lastRunPeriod?: string };
type HealthRecord = { id: string; kind: 'sleep' | 'meal' | 'exercise' | 'steps' | 'height' | 'weight' | 'heartRate' | 'stress' | 'pai'; value: number; note: string; createdAt: string; externalKey?: string };
type MemoryItem = { id: string; kind: '目标' | '偏好' | '观察'; title: string; note: string; active: boolean; sendAllowed: boolean; source: string; purpose: string; updatedAt: string };
type PrivacySettings = { health: boolean; finance: boolean; schedule: boolean; memory: boolean };
type VaultItem = { id: string; title: string; usernameHint: string; note: string };
type TravelItem = { id: string; kind: 'train' | 'flight'; number: string; from: string; to: string; departAt: string; arriveAt: string; seat: string; terminal: string; status: 'upcoming' | 'completed' | 'changed'; source: 'manual' | 'calendar' | 'notification' | 'import'; verified: boolean };
type InvestmentKind = 'fund' | 'stock' | 'crypto' | 'meme';
type PricePoint = { date: string; price: number };
type InvestmentHolding = { id: string; accountId: string; kind: InvestmentKind; name: string; code: string; contract: string; network: string; quantity: number; averageCost: number; currentPrice: number; currency: Currency; updatedAt: string; quoteStatus: 'sample' | 'manual' | 'live'; history: PricePoint[] };
type ExchangeRate = { currency: string; cnyRate: number; asOf: string; source: 'manual' | 'daily'; updatedAt: string };
type AppData = { schemaVersion: 3 | 4; demoMode: boolean; hideAmounts: boolean; schedules: ScheduleItem[]; accounts: Account[]; transactions: Transaction[]; recurringRules: RecurringRule[]; healthRecords: HealthRecord[]; travels: TravelItem[]; investments: InvestmentHolding[]; exchangeRates: ExchangeRate[]; memories: MemoryItem[]; privacy: PrivacySettings; vaultItems: VaultItem[]; inboxItems: InboxItem[]; lastConfirmedInboxId: string | null; auditLog: AuditEntry[]; theme: 'light' | 'dark'; permissionOnboarding: PermissionOnboardingState };
type ExpenseDraft = { kind: 'expense'; amount: number; merchant: string; category: string; accountId: string; source: string; currency: Currency; reimbursable: boolean };
type ScheduleDraft = { kind: 'schedule'; title: string; date: string; time: string };
type TravelDraft = { kind: 'travel'; travelKind: TravelKind; number: string; from: string; to: string; date: string; departTime: string; arriveTime?: string };
type HealthDraft = { kind: 'health'; metric: HealthMetric; value: number };
type CaptureDraft = ExpenseDraft | ScheduleDraft | TravelDraft | HealthDraft;
const HEALTH_METRIC_LABELS: Record<HealthMetric, string> = { steps: '步数', heartRate: '心率', stress: '压力', sleep: '睡眠', pai: 'PAI', height: '身高', weight: '体重' };

const TODAY = localDateKey();
const STORAGE_KEY = 'self-agent:local-data:v1';
type AiConfig = { baseUrl: string; model: string; apiKey: string; configured: boolean };
const emptyAi: AiConfig = { baseUrl: '', model: 'gpt-4o-mini', apiKey: '', configured: false };
const MONTH = TODAY.slice(0, 7);
const now = new Date();
const TODAY_LABEL = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);
const GREETING = now.getHours() < 5 ? '夜深了，先照顾好休息。' : now.getHours() < 11 ? '早上好，今天慢慢来。' : now.getHours() < 14 ? '中午好，给自己留点余地。' : now.getHours() < 18 ? '下午好，一次做好一件事。' : '晚上好，收好今天再休息。';
const accountTypes = [...ACCOUNT_TYPES];
const currencies: Currency[] = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'];
function isCurrency(value: string): value is Currency {
  return (currencies as readonly string[]).includes(value);
}
function isFxCurrency(value: string): value is Exclude<Currency, 'CNY'> {
  return value !== 'CNY' && isCurrency(value);
}
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
  schemaVersion: 4,
  demoMode: true,
  hideAmounts: false,
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
    { id: 'm1', kind: '目标', title: '每月结余至少 2,000 元', note: '用于生成财务提醒，不自动修改账户。', active: true, sendAllowed: false, source: '演示数据', purpose: '用于生成财务提醒，不自动修改账户。', updatedAt: TODAY },
    { id: 'm2', kind: '偏好', title: '23:30 前开始睡前准备', note: '提醒保持温和，不因一次未完成而批评。', active: true, sendAllowed: false, source: '演示数据', purpose: '用于提醒语气与作息建议', updatedAt: TODAY },
    { id: 'm3', kind: '观察', title: '睡眠不足后外卖支出可能上升', note: '只是相关性观察，7 天后复核。', active: false, sendAllowed: false, source: '演示数据', purpose: '用于观察复核，不自动下诊断', updatedAt: TODAY },
  ],
  privacy: { health: true, finance: true, schedule: true, memory: false },
  vaultItems: [
    { id: 'v1', title: '招商银行', usernameHint: '账号已保存', note: '等待 Android Autofill 接管' },
    { id: 'v2', title: '个人邮箱', usernameHint: '账号已保存', note: '不在网页保存密码明文' },
  ],
  inboxItems: [],
  lastConfirmedInboxId: null,
  auditLog: [],
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: TODAY, settingsOpened: false },
};

const emptyData: AppData = {
  schemaVersion: 4,
  demoMode: false,
  hideAmounts: false,
  schedules: [],
  accounts: [],
  transactions: [],
  recurringRules: [],
  healthRecords: [],
  travels: [],
  investments: [],
  exchangeRates: [],
  memories: [],
  privacy: { health: false, finance: false, schedule: false, memory: false },
  vaultItems: [],
  inboxItems: [],
  lastConfirmedInboxId: null,
  auditLog: [],
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: false, completedAt: null, settingsOpened: false },
};

function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function currencyMark(currency: Currency) { return currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : currency === 'EUR' ? '€' : 'JP¥'; }
function formatAssetAmount(currency: string, amount: number) {
  return `${amount < 0 ? '−' : ''}${currencyMark(currency as Currency)} ${money(Math.abs(amount))}`;
}
function formatCnyWealthSummary(accounts: { type: string; currency: string; balance: number; id?: string }[], transactions: { kind: string; currency?: string; amount?: number; accountAmount?: number; reimbursable?: boolean; reimbursed?: boolean }[] = [], rates: ExchangeRate[] = [], holdings: { accountId: string; quantity: number; currentPrice: number }[] = []) {
  const total = cnyWealthTotal(accounts, transactions, rates, holdings);
  return total.unresolved.length ? `¥ ${money(total.convertedCny)}（待折算 ${total.unresolved.map((item) => `${item.currency} ${money(item.amount)}`).join(' · ')}）` : `¥ ${money(total.convertedCny)}`;
}
type NativeAiBridge = {
  nativeReady?: () => boolean;
  saveAiConfig?: (json: string) => void;
  aiConfigStatus?: () => string;
  clearAiConfig?: () => void;
  askAi?: (json: string) => void;
  exportBackup?: (json: string) => void;
  importBackup?: () => void;
  clearReminders?: () => void;
};

function readNativeAiConfig(native?: NativeAiBridge | null): AiConfig {
  try {
    const status = JSON.parse(native?.aiConfigStatus?.() || '{}') as { baseUrl?: string; model?: string; configured?: boolean };
    return { baseUrl: status.baseUrl || '', model: status.model || 'gpt-4o-mini', apiKey: '', configured: Boolean(status.configured) };
  } catch {
    return emptyAi;
  }
}

function askNativeAi(native: NativeAiBridge | undefined, payload: { requestId: string; model: string; messages: { role: string; content: string }[] }): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener(AI_REPLY_EVENT, onReply);
      reject(new Error('timeout'));
    }, 45_000);
    function onReply(event: Event) {
      const detail = (event as CustomEvent<{ v?: number; requestId?: string; ok?: boolean; content?: string; error?: string }>).detail;
      if (!detail || detail.requestId !== payload.requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener(AI_REPLY_EVENT, onReply);
      if (detail.ok && detail.content) resolve(detail.content);
      else reject(new Error(detail?.error || 'offline'));
    }
    window.addEventListener(AI_REPLY_EVENT, onReply);
    native?.askAi?.(JSON.stringify(payload));
  });
}
function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function localStamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${localDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function investmentValue(item: InvestmentHolding) { return item.quantity * item.currentPrice; }
function investmentProfit(item: InvestmentHolding) { return investmentValue(item) - item.quantity * item.averageCost; }
function toAccounts(accounts: Account[]): Account[] {
  return accounts.map((account) => (
    /理财账户/.test(account.type) && !Number.isFinite(account.openingBalance)
      ? account
      : { ...account, openingBalance: Number.isFinite(account.openingBalance) ? Number(account.openingBalance) : account.balance }
  ));
}
function toTransactions(transactions: Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>): Transaction[] {
  return transactions.map((item) => ({
    id: item.id,
    kind: item.kind,
    amount: Math.abs(Number(item.amount ?? item.accountAmount ?? 0)),
    accountAmount: Math.abs(Number(item.accountAmount ?? item.amount ?? 0)),
    currency: (item.currency as Currency) ?? 'CNY',
    merchant: item.merchant ?? '',
    category: item.category ?? '',
    accountId: item.accountId,
    targetAccountId: item.targetAccountId,
    targetAmount: item.targetAmount,
    targetCurrency: item.targetCurrency,
    exchangeRate: item.exchangeRate,
    source: item.source ?? '手动记录',
    reimbursable: item.reimbursable ?? false,
    reimburseAccountId: item.reimburseAccountId,
    reimbursed: item.reimbursed ?? false,
    reimbursementForId: item.reimbursementForId,
    reimbursementTransactionId: item.reimbursementTransactionId,
    recurringRuleId: item.recurringRuleId,
    createdAt: item.createdAt ?? localStamp(),
    occurredAt: item.occurredAt ?? item.createdAt,
    occurredAtEstimated: item.occurredAtEstimated,
    status: item.status,
    reversesId: item.reversesId,
    reversedBy: item.reversedBy,
    postings: item.postings,
    idempotencyKey: item.idempotencyKey,
  }));
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
  const migrated = migrateToSchemaV4({ schemaVersion: raw.schemaVersion, transactions: rawTransactions });
  const finance = normalizeFinanceRecords(rawAccounts, migrated.transactions, investments);
  const accounts = toAccounts(finance.accounts as Account[]);
  const transactions = toTransactions(finance.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>);
  const inbox = migrateInboxStore(raw);
  const auditLog = migrateAuditLog(raw);
  return {
    schemaVersion: 4,
    demoMode: raw.demoMode ?? detectLegacyDemoData(raw),
    hideAmounts: raw.hideAmounts === true,
    schedules: raw.schedules ?? [],
    accounts,
    transactions,
    recurringRules: reconcileRecurringConfirmations(raw.recurringRules ?? [], transactions),
    healthRecords: raw.healthRecords ?? [],
    travels: raw.travels ?? [],
    investments,
    exchangeRates: (raw.exchangeRates ?? []).filter((rate): rate is ExchangeRate => Boolean(rate && rate.currency !== 'CNY' && currencies.includes(rate.currency as Currency) && Number.isFinite(rate.cnyRate) && rate.cnyRate > 0 && typeof rate.asOf === 'string' && typeof rate.updatedAt === 'string')).map((rate) => ({ ...rate, source: rate.source === 'daily' ? 'daily' : 'manual' })),
    memories: (raw.memories ?? []).map((item) => {
      const memory = normalizeMemory(item);
      const kind: MemoryItem['kind'] = memory.kind === '目标' || memory.kind === '偏好' ? memory.kind : '观察';
      return { ...memory, kind };
    }),
    privacy: migratePrivacySettings({ ...emptyData.privacy, ...(raw.privacy ?? {}) }),
    vaultItems: sanitizeBackupVaultItems(raw.vaultItems),
    inboxItems: inbox.inboxItems,
    lastConfirmedInboxId: inbox.lastConfirmedInboxId,
    auditLog,
    theme: raw.theme ?? 'light',
    permissionOnboarding: normalizePermissionOnboarding(raw.permissionOnboarding),
  };
}
function withInboxEvent(current: AppData, event: InboxLifecycleEvent): AppData {
  const next = applyInboxLifecycle({ inboxItems: current.inboxItems, auditLog: current.auditLog }, event);
  return { ...current, inboxItems: next.inboxItems, auditLog: next.auditLog };
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

function TransactionComposer({ accounts, currency, editing, onClose, onSubmit, onDelete }: {
  accounts: Account[];
  currency: Currency;
  editing?: Transaction;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
}) {
  const [kind, setKind] = useState<TransactionKind>(editing?.kind === 'income' || editing?.kind === 'transfer' ? editing.kind : 'expense');
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(String(editing?.amount ?? ''));
  const [reimbursable, setReimbursable] = useState(Boolean(editing?.reimbursable));
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? '');
  const [targetAccountId, setTargetAccountId] = useState(editing?.targetAccountId ?? '');
  const source = accounts.find((account) => account.id === accountId);
  const target = accounts.find((account) => account.id === targetAccountId);
  const sameCurrency = !target || source?.currency === target.currency;
  const fields = financeTransactionFields(kind === 'settlement' ? 'transfer' : kind === 'adjustment' ? 'adjustment' : kind, { reimbursable, sameCurrency: kind === 'transfer' ? sameCurrency : true });
  const phaseKind = kind === 'transfer' || kind === 'income' ? kind : 'expense';
  const phases = transactionFormPhases(phaseKind, { reimbursable, sameCurrency: kind === 'transfer' ? sameCurrency : true });
  const current = phases[Math.min(step, phases.length - 1)] ?? [];
  const persist = (name: string) => phases.slice(0, step + 1).some((phase) => phase.includes(name));
  const show = (name: string) => current.includes(name);
  const previewing = current.includes('preview');
  void fields;
  return <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><form key={editing?.id ?? 'new-transaction'} onSubmit={onSubmit} className="sheet scroll-sheet"><div className="handle" /><header><div><span>{editing ? 'EDIT RECORD' : 'NEW RECORD'}</span><h2>{editing ? '编辑账目' : '确认一笔流水'}</h2></div><button type="button" onClick={onClose}>×</button></header>
    {persist('kind') && <div className="row" hidden={!show('kind')}><label>类型<select name="kind" value={kind} onChange={(event) => { setKind(event.target.value as TransactionKind); setStep(0); }}><option value="expense">支出</option><option value="income">收入</option><option value="transfer">账户转账</option></select></label>{persist('amount') && <label hidden={!show('amount')}>金额<input required name="amount" inputMode="decimal" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>}</div>}
    {persist('currency') && <div className="row" hidden={!show('currency') && !show('accountId')}><label hidden={!show('currency')}>币种<select name="currency" defaultValue={editing?.currency ?? source?.currency ?? currency}>{currencies.map((item) => <option key={item}>{item}</option>)}</select></label>{persist('accountId') && <label hidden={!show('accountId')}>账户<select name="accountId" value={accountId} onChange={(event) => setAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>}</div>}
    {persist('merchant') && <label hidden={!show('merchant')}>商家 / 用途<input required={show('merchant')} name="merchant" placeholder="例如：午餐" defaultValue={editing?.merchant} /></label>}
    {persist('category') && <label hidden={!show('category')}>分类<select name="category" defaultValue={editing?.category}><option>餐饮</option><option>交通</option><option>生活</option><option>医疗</option><option>订阅</option><option>其他</option></select></label>}
    {persist('targetAccountId') && <label hidden={!show('targetAccountId')}>转入账户<select name="targetAccountId" value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>}
    {(persist('rate') || persist('targetAmount')) && <div className="row" hidden={!show('rate') && !show('targetAmount')}>{persist('rate') && <label hidden={!show('rate')}>汇率<input name="exchangeRate" type="number" min="0.000001" step="0.000001" defaultValue={editing?.exchangeRate ?? 1} /></label>}{persist('targetAmount') && <label hidden={!show('targetAmount')}>对方金额<input name="targetAmount" type="number" min="0.01" step="0.01" defaultValue={editing?.targetAmount} /></label>}</div>}
    {persist('reimbursable') && <label className="check-option" hidden={!show('reimbursable')}><input name="reimbursable" type="checkbox" checked={reimbursable} onChange={(event) => setReimbursable(event.target.checked)} />待报销（垫付时增加待收回）</label>}
    {persist('reimburseAccountId') && <label hidden={!show('reimburseAccountId')}>报销记入（待收回）<select name="reimburseToAccountId" defaultValue={editing?.reimburseAccountId ?? accounts.find((account) => accountRole(account.type) === 'receivable')?.id}>{accounts.filter((account) => accountRole(account.type) === 'receivable').map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>}
    {persist('reimburseAccountId') && source && accounts.find((account) => account.id === (editing?.reimburseAccountId ?? accounts.find((item) => accountRole(item.type) === 'receivable')?.id))?.currency !== source.currency && <label hidden={!show('reimburseAccountId')}>待收回金额<input name="targetAmount" type="number" min="0.01" step="0.01" defaultValue={editing?.targetAmount} /></label>}
    {previewing && <p className="form-tip">{previewPostedImpact({ kind, amount: Number(amount) || 0, accountName: source?.name || '账户', reimbursable, targetName: target?.name })}</p>}
    <small className="form-tip" hidden={previewing}>勾选待报销：支出账户减少，待收回立即增加。到账时再点入账，填写金额和对方账户。</small>
    {step > 0 && <button type="button" className="secondary-button" onClick={() => setStep((current) => Math.max(0, current - 1))}>上一步</button>}
    {!previewing && <button className="save" type="button" onClick={() => setStep((current) => Math.min(phases.length - 1, current + 1))}>下一步</button>}
    {previewing && <button className="save" type="submit">{editing ? '保存修改' : '确认入账'}</button>}
    {editing && onDelete && <button className="danger-button" type="button" onClick={onDelete}>删除这笔账目</button>}
  </form></div>;
}

export default function Home() {
  const [data, setData] = useState<AppData>(emptyData);
  const schedulesRef = useRef(data.schedules);
  schedulesRef.current = data.schedules;
  const [hydrated, setHydrated] = useState(false);
  const [schemaFrozen, setSchemaFrozen] = useState(false);
  const [tab, setTabState] = useState<Tab>('home');
  const [history, setHistory] = useState<Tab[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig>(emptyAi);
  const [nativeOn, setNativeOn] = useState(false);
  const [caps, setCaps] = useState<CapabilityStatusSnapshot>({ accessibility: false, notifications: false, notificationListener: false, autofill: false });
  const [permissionOnboardingOpen, setPermissionOnboardingOpen] = useState(false);
  const [vaultMeta, setVaultMeta] = useState<{ title: string; usernameHint: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [sheet, setSheet] = useState<'schedule' | 'transaction' | 'account' | 'recurring' | 'exchange-rate' | 'health' | 'travel' | 'holding' | 'settle-account' | 'settle-reimbursement' | null>(null);
  const [financeCurrency, setFinanceCurrency] = useState<Currency>('CNY');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editingRateCurrency, setEditingRateCurrency] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [settlingAccountId, setSettlingAccountId] = useState<string | null>(null);
  const [settlingTransactionId, setSettlingTransactionId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [captureText, setCaptureText] = useState('');
  const [editingInboxId, setEditingInboxId] = useState<string | null>(null);
  const captureSourceRef = useRef<InboxSource>('manual');
  const overlayReturnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const open = Boolean(sheet) || permissionOnboardingOpen;
    if (!open) return;
    overlayReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = document.querySelector<HTMLElement>('.overlay[role="dialog"]');
    overlay?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (!dialogShouldDismiss(event.key)) return;
      if (sheet) {
        setSheet(null);
        setEditingScheduleId(null);
        setEditingTransactionId(null);
        setEditingRecurringId(null);
        setSettlingAccountId(null);
      }
      if (permissionOnboardingOpen) setPermissionOnboardingOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      overlayReturnFocus.current?.focus?.();
    };
  }, [sheet, permissionOnboardingOpen]);

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
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    const onHardwareBack = () => { goBackRef.current(); };
    window.addEventListener('self-agent:back', onHardwareBack);
    return () => window.removeEventListener('self-agent:back', onHardwareBack);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<AppData>;
          try {
            const existingRaw = window.localStorage.getItem(SCHEMA_V3_BACKUP_KEY);
            const existing = existingRaw ? JSON.parse(existingRaw) as { checksum?: string; fromVersion?: number; toVersion?: number; payload?: unknown } : null;
            const backup = createSchemaV4MigrationBackup(parsed, existing?.checksum ? existing as { fromVersion: number; toVersion: 4; checksum: string; payload: unknown } : null);
            if (backup && !existingRaw) window.localStorage.setItem(SCHEMA_V3_BACKUP_KEY, JSON.stringify(backup));
            const decision = applySchemaV4Migration(parsed, backup);
            if (!decision.persist) {
              setSchemaFrozen(true);
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decision.data));
              setData(normalizeData(decision.data as Partial<AppData>));
            } else {
              setData(normalizeData(parsed));
            }
          } catch {
            setData(normalizeData(parsed));
          }
        }
        const leftover = migrateLegacyAiLocalStorage(window.localStorage);
        const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative;
        if (native?.nativeReady?.()) {
          if (leftover?.apiKey) native.saveAiConfig?.(JSON.stringify(leftover));
          window.sessionStorage.removeItem(AI_CONFIG_STORAGE_KEY);
          setAiConfig(readNativeAiConfig(native));
        } else {
          const loaded = leftover
            ? { ...persistBrowserAiConfig(window.sessionStorage, window.localStorage, leftover), apiKey: leftover.apiKey, configured: Boolean(leftover.baseUrl && leftover.apiKey) }
            : loadBrowserAiConfig(window.sessionStorage, window.localStorage);
          setAiConfig({ baseUrl: loaded.baseUrl, model: loaded.model, apiKey: loaded.apiKey, configured: loaded.configured });
        }
      }
      catch { /* Corrupt local data should not prevent the app from opening. */ }
      finally { setHydrated(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!hydrated || !shouldShowPermissionOnboarding(data.permissionOnboarding)) return;
    const timer = window.setTimeout(() => setPermissionOnboardingOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, data.permissionOnboarding]);
  useEffect(() => {
    function onTravel(event: Event) {
      const items = (event as CustomEvent<TravelItem[]>).detail;
      if (!Array.isArray(items) || !items.length) return;
      setData((current) => {
        let next = current;
        for (const item of items) {
          const key = `${item.kind}-${item.number}-${String(item.departAt).slice(0, 10)}`;
          const existing = current.travels.some((row) => `${row.kind}-${row.number}-${row.departAt.slice(0, 10)}` === key);
          next = withInboxEvent(next, {
            type: 'enqueue',
            item: inboxItemFromTravelNotice({
              id: item.id || uid('inbox'),
              createdAt: localStamp(),
              travel: item,
              existing,
            }),
            timestamp: localStamp(),
            id: uid('audit'),
          });
        }
        return next;
      });
      notify('行程已放入收件箱，确认后才会保存');
    }
    function onHealth(event: Event) {
      const detail = (event as CustomEvent<{ records?: Parameters<typeof healthRecordsFromSnapshots>[0]; source?: string }>).detail || {};
      const snapshots = Array.isArray(detail.records) ? detail.records : [detail];
      const mapped = healthRecordsFromSnapshots(snapshots, detail.source || 'health-connect')
        .map((item) => ({ ...item, id: uid('health'), kind: item.kind as HealthRecord['kind'], note: item.note || item.kind, createdAt: item.createdAt || TODAY }));
      if (!mapped.length) return;
      setData((current) => ({ ...current, healthRecords: upsertByExternalKey(current.healthRecords, mapped) }));
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
    const w = window as Window & { SelfAgentNative?: NativeAiBridge & { vaultMeta?: () => string; capabilityStatus?: () => string } };
    function refreshNative() {
      try {
        if (!w.SelfAgentNative?.nativeReady?.()) return;
        setNativeOn(true);
        const meta = JSON.parse(w.SelfAgentNative.vaultMeta?.() || '[]') as { title: string; usernameHint: string }[];
        if (Array.isArray(meta)) setVaultMeta(meta);
        setCaps(parseCapabilityStatus(JSON.parse(w.SelfAgentNative.capabilityStatus?.() || '{}')));
        const sessionAi = loadBrowserAiConfig(window.sessionStorage, window.localStorage);
        if (sessionAi.apiKey) {
          w.SelfAgentNative.saveAiConfig?.(JSON.stringify({ baseUrl: sessionAi.baseUrl, model: sessionAi.model, apiKey: sessionAi.apiKey }));
          window.sessionStorage.removeItem(AI_CONFIG_STORAGE_KEY);
        }
        setAiConfig((current) => {
          const next = readNativeAiConfig(w.SelfAgentNative);
          if (current.baseUrl === next.baseUrl && current.model === next.model && current.configured === next.configured && !current.apiKey) return current;
          return next;
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
  useEffect(() => {
    if (!hydrated || schemaFrozen) return;
    if (!persistJson(window.localStorage, STORAGE_KEY, data).ok) notify('本机存储写入失败，刚才的更改还没保存');
  }, [data, hydrated, schemaFrozen]);
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
        return { ...current, exchangeRates: applyDailyFxRates(current.exchangeRates, (detail.rates ?? []).map((rate) => ({ ...rate, source: 'daily' }))), investments: refreshHoldingsValuation(current.accounts, investments, detail.quotes ?? []).holdings };
      });
      notify('已按今日参考价更新估值，账本流水未改动');
    }
    window.addEventListener('self-agent:quotes-updated', onQuotes);
    return () => window.removeEventListener('self-agent:quotes-updated', onQuotes);
  }, []);
  useEffect(() => {
    function onCaptureText(event: Event) {
      const detail = (event as CustomEvent<{ text?: string; source?: string }>).detail || {};
      const text = String(detail.text || '').trim();
      if (!text) { notify('没有识别到文字，请重试或手动输入'); return; }
      const hinted = detail.source === 'voice' || detail.source === 'ocr' ? detail.source : captureSourceRef.current;
      if (hinted === 'voice' || hinted === 'ocr') captureSourceRef.current = hinted;
      setCaptureText((current) => `${current}${current ? ' ' : ''}${text}`.slice(0, 400));
      navigate('capture');
      notify('已填入输入框，放入收件箱后才会保存');
    }
    window.addEventListener('self-agent:capture-text', onCaptureText);
    return () => window.removeEventListener('self-agent:capture-text', onCaptureText);
  }, []);
  useEffect(() => {
    function onBackupImported(event: Event) {
      const detail = (event as CustomEvent<{ text?: string }>).detail || {};
      try {
        applyImportedBackup(JSON.parse(String(detail.text || '')) as unknown);
      } catch { notify('无法读取备份，现有数据未改变'); }
    }
    window.addEventListener('self-agent:backup-imported', onBackupImported);
    return () => window.removeEventListener('self-agent:backup-imported', onBackupImported);
  }, []);
  useEffect(() => {
    function onAiConfig(event: Event) {
      const detail = (event as CustomEvent<{ v?: number; baseUrl?: string; model?: string; configured?: boolean; hasKey?: boolean }>).detail || {};
      setAiConfig({
        baseUrl: detail.baseUrl || '',
        model: detail.model || 'gpt-4o-mini',
        apiKey: '',
        configured: Boolean(detail.configured || detail.hasKey),
      });
    }
    window.addEventListener(AI_CONFIG_EVENT, onAiConfig);
    return () => window.removeEventListener(AI_CONFIG_EVENT, onAiConfig);
  }, []);
  useEffect(() => {
    function onPayment(event: Event) {
      const detail = (event as CustomEvent<Partial<ExpenseDraft> & { title?: string; dir?: string; source?: string; accountHint?: string; id?: string }>).detail || {};
      const merchant = detail.merchant || detail.title || '支付成功';
      const accountId = resolvePaymentAccountId(data.accounts, detail.source, detail.accountHint) ?? '';
      const fingerprint = typeof detail.id === 'string' && detail.id.trim() ? detail.id.trim() : undefined;
      setData((current) => withInboxEvent(current, {
        type: 'enqueue',
        item: inboxItemFromPayment({
          id: uid('inbox'),
          createdAt: localStamp(),
          amount: Number(detail.amount ?? 0),
          merchant,
          category: detail.category,
          source: String(detail.source || 'Android 支付通知'),
          accountId,
          dir: detail.dir,
          fingerprint,
        }),
        timestamp: localStamp(),
        id: uid('audit'),
      }));
      navigate('capture');
      notify('支付通知已放入收件箱，确认后才会入账');
    }
    function onAutoTxn(event: Event) {
      const detail = (event as CustomEvent<{ id?: string; amount?: number | null; title?: string; category?: string; source?: string; accountHint?: string; dir?: string; autoSave?: boolean }>).detail || {};
      onPayment(new CustomEvent('x', { detail: { amount: detail.amount ?? 0, merchant: detail.title, category: detail.category, source: detail.source, accountHint: detail.accountHint, dir: detail.dir, id: detail.id } }));
    }
    window.addEventListener('self-agent:payment-detected', onPayment);
    window.addEventListener('self-agent:auto-txn', onAutoTxn);
    (window as Window & { onAutoTxn?: (p: unknown) => void }).onAutoTxn = (p) => onAutoTxn(new CustomEvent('self-agent:auto-txn', { detail: p }));
    return () => {
      window.removeEventListener('self-agent:payment-detected', onPayment);
      window.removeEventListener('self-agent:auto-txn', onAutoTxn);
    };
  }, [data.accounts]);

  const editingSchedule = editingScheduleId ? data.schedules.find((item) => item.id === editingScheduleId) : undefined;
  const todaySpend = useMemo(() => getDailySpend(data.transactions, TODAY, 'CNY'), [data.transactions]);
  const investmentPlans = useMemo(() => planInvestmentMigrations(data.accounts, data.investments), [data.accounts, data.investments]);
  const totalBalanceLabel = useMemo(() => formatCnyWealthSummary(data.accounts, data.transactions, data.exchangeRates, data.investments), [data.accounts, data.transactions, data.exchangeRates, data.investments]);
  const hasBusinessData = homeHasAuthoritativeData(data);
  const hasFinanceData = homeHasFinanceData(data);
  const inboxPending = useMemo(() => pendingInboxItems(data.inboxItems), [data.inboxItems]);
  const inboxPendingCount = inboxPending.length;
  const recentTransactions = useMemo(() => data.transactions.filter((item) => item.status !== 'reversed' && item.status !== 'superseded' && !item.reversesId).slice(0, 3), [data.transactions]);
  const lastConfirmedInbox = data.inboxItems.find((item) => item.id === data.lastConfirmedInboxId);
  const editingAccount = editingAccountId ? data.accounts.find((item) => item.id === editingAccountId) : undefined;
  const editingTransaction = editingTransactionId ? data.transactions.find((item) => item.id === editingTransactionId) : undefined;
  const editingHolding = editingHoldingId ? data.investments.find((item) => item.id === editingHoldingId) : undefined;
  const editingRecurring = editingRecurringId ? data.recurringRules.find((item) => item.id === editingRecurringId) : undefined;
  const settlingAccount = settlingAccountId ? data.accounts.find((item) => item.id === settlingAccountId) : undefined;
  const settlingTransaction = settlingTransactionId ? data.transactions.find((item) => item.id === settlingTransactionId) : undefined;
  const settlingReimbursement = settlingTransaction ? reimbursementOutstandingAmount(settlingTransaction, data.transactions) : undefined;

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2200); }
  function confirmInvestmentMeaning(accountId: string, choice: 'cash' | 'market' | 'total') {
    setData((current) => ({ ...current, accounts: confirmInvestmentMigration(current.accounts, current.investments, accountId, choice) as Account[] }));
    notify('已按你的选择拆分理财现金');
  }
  function saveAiConfig(next: { baseUrl: string; model: string; apiKey: string }) {
    const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative;
    if (native?.nativeReady?.() && native.saveAiConfig) {
      native.saveAiConfig(JSON.stringify(next));
      setAiConfig({ baseUrl: next.baseUrl, model: next.model, apiKey: '', configured: Boolean(next.baseUrl && (next.apiKey || aiConfig.configured)) });
      notify(next.apiKey ? 'AI 密钥已加密保存到 Android Keystore' : 'AI 接口设置已更新，原密钥保持不变');
    } else {
      const published = persistBrowserAiConfig(window.sessionStorage, window.localStorage, next);
      setAiConfig({ ...published, apiKey: '', configured: Boolean(next.baseUrl && next.apiKey) });
      notify('网页版密钥只保留到当前页面会话，关闭后自动清除');
    }
  }
  async function testAiConnection() {
    const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative;
    if (!native?.nativeReady?.() || !aiConfig.configured) {
      notify(interpretAiConnectionTest({ ok: false, error: 'offline' }).label);
      return;
    }
    if (!validateByokTarget(aiConfig.baseUrl).ok) {
      notify('AI 接口地址不安全');
      return;
    }
    try {
      await askNativeAi(native, { requestId: uid('ping'), model: aiConfig.model, messages: [{ role: 'user', content: 'ping' }] });
      notify(interpretAiConnectionTest({ ok: true }).label);
    } catch (error) {
      notify(interpretAiConnectionTest({ ok: false, error: String(error) }).label);
    }
  }
  function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const editing = editingScheduleId;
    const item: ScheduleItem = { id: editing ?? uid('schedule'), title: String(form.get('title')), date: String(form.get('date')), time: String(form.get('time')), detail: `${String(form.get('detail') || '个人')} · 提前 10 分钟提醒`, color: 'orange', done: false };
    if (!item.date || !item.time) { notify('请填写日期和时间'); return; }
    const sourceSchedules = schedulesRef.current;
    const nextSchedules = editing ? sourceSchedules.map((row) => row.id === editing ? { ...item, done: row.done, color: row.color } : row) : [...sourceSchedules, item];
    schedulesRef.current = nextSchedules;
    setData((current) => ({ ...current, schedules: nextSchedules }));
    setSelectedDate(item.date); setEditingScheduleId(null); setSheet(null);
    pushReminders(nextSchedules, data.recurringRules);
  }
  function pushReminders(schedules: ScheduleItem[], bills: RecurringRule[], feedback = true) {
    const native = (window as Window & { SelfAgentNative?: { syncReminders?: (json: string) => string } }).SelfAgentNative;
    if (!native?.syncReminders) { if (feedback) notify('系统弹窗只在 Android App 里有效'); return true; }
    try {
      const info = JSON.parse(native.syncReminders(JSON.stringify({
        ack: true,
        schedules: schedules.filter((item) => !item.done).map((item) => ({ id: item.id, title: item.title, date: item.date, time: item.time })),
        bills: bills.filter((item) => item.enabled).map((item) => ({ id: item.id, name: item.name, dueDay: item.dueDay, amount: item.amount, lastRunPeriod: item.lastRunPeriod || '' })),
      })) || '{}') as { scheduled?: number; notifications?: boolean };
      if (feedback) {
        if (info.notifications === false) notify('请允许通知并打开横幅，否则不会弹窗');
        else if (!info.scheduled) notify('这个时间已过，没有排上提醒。请选几分钟之后');
        else notify(`已设置 ${info.scheduled} 个提醒（提前10分钟 + 到点）`);
      }
      return true;
    } catch {
      if (feedback) notify('提醒没有设置成功');
      return false;
    }
  }
  function toggleSchedule(id: string) {
    const current = schedulesRef.current.find((item) => item.id === id);
    if (!current) return;
    const nextSchedules = schedulesRef.current.map((item) => item.id === id ? { ...item, done: !item.done } : item);
    schedulesRef.current = nextSchedules;
    setData((state) => ({ ...state, schedules: nextSchedules }));
    const synced = pushReminders(nextSchedules, data.recurringRules, false);
    notify(!synced ? '日程已更新，但提醒同步失败' : current.done ? '日程已恢复为未完成' : '日程已完成，提醒已取消');
  }
  function deleteSchedule(id: string) {
    const nextSchedules = schedulesRef.current.filter((item) => item.id !== id);
    schedulesRef.current = nextSchedules;
    setData((current) => ({ ...current, schedules: nextSchedules }));
    const synced = pushReminders(nextSchedules, data.recurringRules, false);
    setEditingScheduleId(null); setSheet(null); notify(synced ? '日程已删除' : '日程已删除，但提醒同步失败');
  }
  function saveTransaction(input: ExpenseDraft & { transactionKind?: 'expense' | 'income'; accountAmount?: number }) {
    const transactionKind = input.transactionKind ?? 'expense';
    const reimbursable = transactionKind === 'expense' && input.reimbursable;
    const claimId = reimbursable ? data.accounts.find((account) => accountRole(account.type) === 'receivable' && account.currency === input.currency)?.id : undefined;
    const transaction: Transaction = { id: uid('transaction'), kind: transactionKind, amount: Math.abs(input.amount), accountAmount: Math.abs(input.accountAmount ?? input.amount), currency: input.currency, merchant: input.merchant, category: transactionKind === 'income' ? '收入' : input.category, accountId: input.accountId, source: input.source, reimbursable, reimburseAccountId: claimId, reimbursed: false, createdAt: localStamp() };
    setData((current) => {
      const posted = postFinanceTransaction(current.accounts, current.transactions, transaction);
      if (!posted.transactions.some((item) => item.id === transaction.id)) return current;
      return { ...current, transactions: toTransactions(posted.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>), accounts: toAccounts(posted.accounts as Account[]) };
    });
    return transaction.id;
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
    const sourceAccount = data.accounts.find((account) => account.id === paidFrom);
    const targetAccount = targetId ? data.accounts.find((account) => account.id === targetId) : undefined;
    const reimburseAccount = data.accounts.find((account) => account.id === reimburseTo);
    if (!Number.isFinite(amount) || amount <= 0) { notify('请输入大于 0 的金额'); return; }
    if (!canHoldMoney(sourceAccount) && accountRole(sourceAccount?.type ?? '') !== 'payable' && accountRole(sourceAccount?.type ?? '') !== 'liability') { notify('请选择真实的资金或信用卡账户'); return; }
    if (kind === 'transfer' && (!targetAccount || targetId === paidFrom)) { notify('请选择不同的转入账户'); return; }
    if (reimbursable && accountRole(reimburseAccount?.type ?? '') !== 'receivable') { notify('报销请记入「待收回」账户，垫付时这里会增加应收'); return; }
    const sourceCurrency = sourceAccount?.currency ?? String(form.get('currency') || 'CNY');
    const targetCurrency = (kind === 'transfer' ? targetAccount?.currency : reimburseAccount?.currency) ?? sourceCurrency;
    const explicitTarget = Number(form.get('targetAmount'));
    const rateRaw = Number(form.get('exchangeRate'));
    let amounts: { sourceAmount: number; targetAmount: number; rate: number };
    try {
      amounts = resolveTransferAmounts({
        sourceCurrency,
        targetCurrency,
        amount,
        rate: Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : undefined,
        targetAmount: Number.isFinite(explicitTarget) && explicitTarget > 0 ? explicitTarget : undefined,
      });
    } catch {
      notify('跨币种请填写待收回金额或汇率，不能默认一比一');
      return;
    }
    const wasSettled = Boolean(previous?.reimbursementTransactionId);
    const draft: Transaction = {
      id: previous?.id ?? uid('transaction'),
      kind,
      amount: amounts.sourceAmount,
      accountAmount: amounts.sourceAmount,
      currency: sourceCurrency as Currency,
      targetAmount: amounts.targetAmount,
      targetCurrency: targetCurrency as Currency,
      exchangeRate: amounts.rate,
      merchant: String(form.get('merchant')),
      category: kind === 'income' ? '收入' : kind === 'transfer' ? '账户转账' : String(form.get('category') || '其他'),
      accountId: paidFrom,
      targetAccountId: kind === 'transfer' ? targetId : undefined,
      source: previous?.source ?? '手动记录',
      reimbursable,
      reimburseAccountId: reimbursable ? reimburseTo : undefined,
      reimbursed: reimbursable ? (wasSettled ? false : previous?.reimbursed ?? false) : false,
      createdAt: previous?.createdAt ?? localStamp(),
    };
    const removedPreview = previous ? removePostedTransaction(data.accounts, data.transactions, previous.id) : { accounts: data.accounts, transactions: data.transactions };
    const preview = postFinanceTransaction(removedPreview.accounts, removedPreview.transactions, draft);
    if (!preview.transactions.some((item) => item.id === draft.id)) { notify('这笔账无法入账，请先检查账户余额'); return; }
    setData((current) => {
      const removed = previous ? removePostedTransaction(current.accounts, current.transactions, previous.id) : { accounts: current.accounts, transactions: current.transactions };
      const posted = postFinanceTransaction(removed.accounts, removed.transactions, draft);
      if (!posted.transactions.some((item) => item.id === draft.id)) return current;
      return { ...current, accounts: toAccounts(posted.accounts as Account[]), transactions: toTransactions(posted.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>) };
    });
    setEditingTransactionId(null); setSheet(null); notify(previous ? (wasSettled ? '账目已更新，原报销到账已撤销，请重新入账' : reimbursable ? '微信等支出账户已减少，待收回已增加' : '账目和账户余额已更新') : reimbursable ? '支出已记，待收回应收已增加；到账后再点入账' : '流水已确认入账');
  }
  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const tones: Account['tone'][] = ['forest', 'clay', 'ink'];
    const previous = editingAccountId ? data.accounts.find((item) => item.id === editingAccountId) : undefined;
    const currency = String(form.get('currency')) as Currency;
    if (previous && data.investments.some((item) => item.accountId === previous.id && item.currency !== currency)) { notify('请先调整该账户内持仓币种'); return; }
    const nextBalance = normalizeAccountBalance(String(form.get('type')), Number(form.get('balance') || 0));
    const account: Account = { id: previous?.id ?? uid('account'), name: String(form.get('name')), type: String(form.get('type')), balance: previous ? previous.balance : nextBalance, currency, tone: previous?.tone ?? tones[data.accounts.length % tones.length], openingBalance: previous?.openingBalance ?? nextBalance };
    setData((current) => {
      const renamed = previous ? current.accounts.map((item) => item.id === previous.id ? { ...account, balance: item.balance, openingBalance: item.openingBalance } : item) : [...current.accounts, account];
      if (previous && Math.abs(nextBalance - previous.balance) > 0.0001) {
        const adjusted = postBalanceAdjustment(renamed, current.transactions, { id: uid('transaction'), accountId: previous.id, targetBalance: nextBalance, createdAt: localStamp() });
        return { ...current, accounts: toAccounts(adjusted.accounts as Account[]), transactions: toTransactions(adjusted.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>) };
      }
      return { ...current, accounts: renamed };
    }); setEditingAccountId(null); setSheet(null); setFinanceCurrency(account.currency); notify(previous ? (Math.abs(nextBalance - (previous.balance)) > 0.0001 ? '已用余额调整流水更新账户' : '账户资料已更新') : '账户已添加');
  }
  function deleteAccount(id?: string) {
    const accountId = id ?? editingAccountId;
    if (!accountId) return;
    const gate = canDeleteAccount({ accountId, accounts: data.accounts, transactions: data.transactions, holdings: data.investments, rules: data.recurringRules });
    if (!gate.ok) { notify(gate.reason || '无法删除账户'); return; }
    if (!window.confirm('确定删除这个账户吗？')) return;
    setData((current) => ({ ...current, accounts: current.accounts.filter((item) => item.id !== accountId) }));
    setEditingAccountId(null); setSelectedAccountId(null); setSheet(null); notify('账户已删除');
  }
  function addExchangeRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const currency = String(form.get('currency'));
    const cnyRate = Number(form.get('cnyRate'));
    const asOf = String(form.get('asOf'));
    if (!isFxCurrency(currency) || !Number.isFinite(cnyRate) || cnyRate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { notify('请填写有效的非人民币汇率和适用日期'); return; }
    const rate: ExchangeRate = { currency, cnyRate, asOf, source: 'manual', updatedAt: localStamp() };
    setData((current) => ({ ...current, exchangeRates: [...current.exchangeRates.filter((item) => item.currency !== currency), rate] }));
    setEditingRateCurrency(null); setSheet(null); notify(`${currency} 汇率已手动保存`);
  }
  function deleteExchangeRate(currency: string) {
    setData((current) => ({ ...current, exchangeRates: current.exchangeRates.filter((item) => item.currency !== currency) }));
    notify(`${currency} 汇率已删除，该币种将不计入人民币总额`);
  }
  function deleteTransaction(id?: string) {
    const previous = data.transactions.find((item) => item.id === (id ?? editingTransactionId));
    if (!previous || !window.confirm('确定删除这笔账目吗？对应账户余额会自动恢复。')) return;
    setData((current) => {
      const removed = removePostedTransaction(current.accounts, current.transactions, previous.id);
      return {
        ...current,
        accounts: toAccounts(removed.accounts as Account[]),
        transactions: toTransactions(removed.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>),
        recurringRules: releaseRecurringConfirmation(current.recurringRules, removed.transactions, previous),
      };
    });
    setEditingTransactionId(null); setSheet(null); notify('账目已删除，余额已恢复');
  }
  function settleReimbursement(id: string) {
    const previous = data.transactions.find((item) => item.id === id);
    if (!previous?.reimbursable || previous.reimbursed) { notify('这笔不是待报销，或已经入账'); return; }
    setSettlingTransactionId(id);
    setSheet('settle-reimbursement');
  }
  function confirmReimbursementSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const previous = settlingTransactionId ? data.transactions.find((item) => item.id === settlingTransactionId) : undefined;
    if (!previous?.reimbursable || previous.reimbursed) { notify('这笔不是待报销，或已经入账'); return; }
    const amount = Number(form.get('amount'));
    const counterpartId = String(form.get('counterpartId'));
    const counterpart = data.accounts.find((account) => account.id === counterpartId);
    if (!counterpart || !canHoldMoney(counterpart)) { notify('请指定资金账户作为报销到账账户'); return; }
    if (!(amount > 0)) { notify('请输入大于 0 的金额'); return; }
    const outstanding = reimbursementOutstandingAmount(previous, data.transactions);
    if (counterpart.currency !== outstanding.currency) { notify(`报销到账账户必须使用 ${outstanding.currency}`); return; }
    if (amount - outstanding.amount > 0.0001) { notify(`本笔剩余应收为 ${outstanding.currency} ${money(outstanding.amount)}`); return; }
    const settlement = buildReimbursementSettlement(previous, { id: uid('transaction'), counterpartId, amount, currency: counterpart.currency });
    const credit: Transaction = {
      id: settlement.id,
      kind: 'settlement',
      amount,
      accountAmount: amount,
      currency: counterpart.currency,
      merchant: `报销入账 · ${previous.merchant}`,
      category: '报销入账',
      accountId: settlement.accountId,
      targetAccountId: settlement.targetAccountId,
      targetAmount: amount,
      targetCurrency: counterpart.currency,
      source: '报销确认',
      reimbursable: false,
      reimbursementForId: previous.id,
      createdAt: localStamp(),
      postings: settlement.postings,
    };
    setData((current) => {
      const posted = settlePostedReimbursement(current.accounts, current.transactions, previous.id, credit);
      return { ...current, accounts: toAccounts(posted.accounts as Account[]), transactions: toTransactions(posted.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>) };
    });
    setSettlingTransactionId(null);
    setSheet(null);
    notify('报销已作为结算入账，不计入月度收入');
  }
  function settleAccount(id: string) {
    const account = data.accounts.find((item) => item.id === id);
    if (!account || account.balance <= 0) { notify('没有可结算的余额'); return; }
    const role = accountRole(account.type);
    if (role !== 'receivable' && !isDebtRole(role)) { notify('这个账户不需要收回或还款'); return; }
    if (role === 'receivable' && hasOutstandingReimbursementsForAccount(data.transactions, account.id)) {
      notify('该账户包含待报销明细，请在对应流水中逐笔入账');
      return;
    }
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
    setData((current) => {
      const posted = postFinanceTransaction(current.accounts, current.transactions, transaction);
      return { ...current, accounts: toAccounts(posted.accounts as Account[]), transactions: toTransactions(posted.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>) };
    });
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
    const draft = generateRecurringDrafts([selected], { period: MONTH, day: Number(TODAY.slice(-2)), createdAt: localStamp() })[0];
    if (!draft) { notify('账单信息不完整，请先编辑'); return; }
    setData((current) => withInboxEvent(current, { type: 'enqueue', item: draft, timestamp: localStamp(), id: uid('audit') }));
    navigate('capture');
    notify('已加入收件箱，确认后才会入账');
  }
  function organizeCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = captureText.trim();
    if (!text) return;
    const parsed = parseNaturalCapture(text, TODAY);
    const draft = parseCapture(text, data.accounts);
    const source: InboxSource = captureSourceRef.current === 'voice' || captureSourceRef.current === 'ocr' ? captureSourceRef.current : 'manual';
    setData((current) => withInboxEvent(current, {
      type: 'enqueue',
      item: inboxItemFromNaturalCapture({
        id: uid('inbox'),
        source,
        createdAt: localStamp(),
        parsed,
        accountId: draft.kind === 'expense' ? draft.accountId : undefined,
      }),
      timestamp: localStamp(),
      id: uid('audit'),
    }));
    captureSourceRef.current = 'manual';
    setCaptureText('');
    notify('已放入收件箱，确认后才会保存');
  }
  function startVoiceCapture() {
    const native = (window as Window & { SelfAgentNative?: { startVoiceCapture?: () => void } }).SelfAgentNative;
    if (!native?.startVoiceCapture) { notify('请在 Android App 中使用语音'); return; }
    captureSourceRef.current = 'voice';
    notify('请开始说话');
    native.startVoiceCapture();
  }
  function pickCaptureImage() {
    const native = (window as Window & { SelfAgentNative?: { pickCaptureImage?: () => void } }).SelfAgentNative;
    if (!native?.pickCaptureImage) { notify('请在 Android App 中选择图片'); return; }
    captureSourceRef.current = 'ocr';
    notify('正在识别图片文字');
    native.pickCaptureImage();
  }
  function patchInboxPayload(id: string, payload: Record<string, unknown>) {
    setData((current) => ({ ...current, inboxItems: updateInboxItemPayload(current.inboxItems, id, payload) }));
  }
  function ignoreInbox(id: string) {
    setData((current) => withInboxEvent(current, { type: 'ignore', itemId: id, timestamp: localStamp(), id: uid('audit') }));
    if (editingInboxId === id) setEditingInboxId(null);
    notify('已忽略，不会写入');
  }
  function recordInboxFail(itemId: string, reason: string, dataScope?: string) {
    setData((current) => withInboxEvent(current, { type: 'fail', itemId, reason, dataScope, timestamp: localStamp(), id: uid('audit') }));
  }
  function mergeConfirmedTravel(current: AppData, payload: Record<string, unknown>): AppData {
    const travelKind = payload.travelKind === 'flight' || payload.kind === 'flight' ? 'flight' : 'train';
    const number = String(payload.number || '');
    const date = String(payload.date || String(payload.departAt || '').slice(0, 10) || TODAY);
    const departTime = String(payload.departTime || String(payload.departAt || '').slice(11, 16) || '08:00');
    const arriveTime = String(payload.arriveTime || String(payload.arriveAt || '').slice(11, 16) || departTime);
    const item: TravelItem = {
      id: uid('travel'),
      kind: travelKind,
      number,
      from: String(payload.from || '待确认'),
      to: String(payload.to || '待确认'),
      departAt: String(payload.departAt || `${date}T${departTime}`),
      arriveAt: String(payload.arriveAt || `${date}T${arriveTime}`),
      seat: String(payload.seat || '待分配'),
      terminal: String(payload.terminal || '待确认'),
      status: 'upcoming',
      source: payload.noticeSource === 'manual' ? 'manual' : payload.noticeSource === 'notification' ? 'notification' : 'import',
      verified: payload.noticeSource === 'notification',
    };
    const key = `${item.kind}-${item.number}-${item.departAt.slice(0, 10)}`;
    const next = [...current.travels];
    const index = next.findIndex((row) => `${row.kind}-${row.number}-${row.departAt.slice(0, 10)}` === key);
    if (index >= 0) next[index] = { ...next[index], ...item, id: next[index].id };
    else next.push(item);
    return { ...current, travels: next.sort((left, right) => left.departAt.localeCompare(right.departAt)) };
  }
  function confirmInbox(id: string) {
    const item = data.inboxItems.find((entry) => entry.id === id && entry.status === 'pending');
    if (!item) return;
    const payload = item.payload;
    if (item.proposedAction === 'create_expense' || item.proposedAction === 'create_income' || item.proposedAction === 'create_transfer') {
      const blocked = inboxConfirmBlockReason(item, data.accounts);
      if (blocked) { recordInboxFail(id, blocked.reason, blocked.dataScope); notify(blocked.reason === 'missing_amount' ? '请先补充金额' : blocked.reason === 'missing_currency' ? '请选择相同币种账户' : blocked.reason === 'missing_reimbursable' ? '请明确这笔是否报销' : blocked.reason === 'missing_target_account' ? '请选择目标债务账户' : blocked.reason === 'insufficient_funds' ? '资金账户余额不足' : blocked.reason === 'overpayment' ? '还款金额不能超过当前欠款' : '请先选择入账账户'); return; }
      const amount = Math.abs(Number(payload.amount ?? 0));
      const accountId = String(payload.accountId || '');
      const account = data.accounts.find((entry) => entry.id === accountId);
      const isTransfer = item.proposedAction === 'create_transfer';
      const transactionKind: TransactionKind = item.proposedAction === 'create_income' ? 'income' : isTransfer ? 'transfer' : 'expense';
      const reimbursable = transactionKind === 'expense' && payload.reimbursable === true;
      const currencyValue = String(payload.currency || account?.currency || '');
      if (!isCurrency(currencyValue)) { recordInboxFail(id, 'missing_currency', 'finance'); notify('请选择账户币种'); return; }
      const currency = currencyValue;
      const claimId = reimbursable ? data.accounts.find((entry) => accountRole(entry.type) === 'receivable' && entry.currency === currency)?.id : undefined;
      const recurringRuleId = typeof payload.recurringRuleId === 'string' ? payload.recurringRuleId : undefined;
      const recurringPeriod = typeof payload.period === 'string' ? payload.period : undefined;
      if (recurringRuleId && recurringPeriod !== MONTH) { recordInboxFail(id, 'stale_period', 'finance'); notify('这条账单草稿已过期，请重新生成'); return; }
      const transaction: Transaction = { id: uid('transaction'), kind: transactionKind, amount, accountAmount: amount, currency, merchant: String(payload.merchant || (isTransfer ? '信用卡还款' : '待补充商家')), category: isTransfer ? '信用卡还款' : transactionKind === 'income' ? '收入' : String(payload.category || '其他'), accountId, targetAccountId: isTransfer ? String(payload.targetAccountId || '') : undefined, targetAmount: isTransfer ? amount : undefined, targetCurrency: isTransfer ? currency : undefined, source: String(payload.paySource || inboxSourceLabel(item.source)), reimbursable, reimburseAccountId: claimId, reimbursed: false, recurringRuleId, createdAt: localStamp(), idempotencyKey: ledgerIdempotencyKeyForInboxItem(item) };
      const resolution = resolveInboxFinanceConfirmation(data.accounts, data.transactions, transaction);
      if (resolution.outcome === 'rejected') { recordInboxFail(id, 'ledger_rejected', 'finance'); notify('这笔账无法入账，请先检查账户'); return; }
      setData((current) => {
        const currentResolution = resolveInboxFinanceConfirmation(current.accounts, current.transactions, transaction);
        if (currentResolution.outcome === 'rejected' || !currentResolution.transactionId) return current;
        const next = withInboxEvent(current, { type: 'confirm', itemId: id, resultEntityId: currentResolution.transactionId, timestamp: localStamp(), id: uid('audit') });
        const lockRecurring = (rules: RecurringRule[]) => recurringRuleId
          ? rules.map((rule) => rule.id === recurringRuleId ? { ...rule, lastRunPeriod: MONTH } : rule)
          : rules;
        return {
          ...next,
          transactions: toTransactions(currentResolution.transactions as Array<Partial<Transaction> & { id: string; kind: TransactionKind; accountId: string }>),
          accounts: toAccounts(currentResolution.accounts as Account[]),
          recurringRules: lockRecurring(next.recurringRules),
          lastConfirmedInboxId: currentResolution.outcome === 'posted' ? id : null,
        };
      });
      notify('已确认并记入账本');
      setEditingInboxId(null);
      return;
    }
    if (item.proposedAction === 'create_travel' || item.proposedAction === 'update_travel') {
      if (!payload.number || !payload.from || !payload.to) { recordInboxFail(id, 'invalid_travel', 'travel'); notify('请补充车次/航班和起终点'); return; }
      setData((current) => {
        const next = withInboxEvent(mergeConfirmedTravel(current, payload), { type: 'confirm', itemId: id, resultEntityId: 'travel', timestamp: localStamp(), id: uid('audit') });
        return { ...next, lastConfirmedInboxId: id };
      });
      notify('已确认并加入行程');
      setEditingInboxId(null);
      return;
    }
    if (item.proposedAction === 'create_health') {
      const value = Number(payload.value);
      const metric = payload.metric as HealthMetric;
      if (!(value > 0) || !HEALTH_METRIC_LABELS[metric]) { recordInboxFail(id, 'invalid_health', 'health'); notify('请补充有效数值'); return; }
      const record: HealthRecord = { id: uid('health'), kind: metric, value, note: `收件箱 · ${HEALTH_METRIC_LABELS[metric]}`, createdAt: localStamp() };
      setData((current) => {
        const next = withInboxEvent(current, { type: 'confirm', itemId: id, resultEntityId: record.id, timestamp: localStamp(), id: uid('audit') });
        return { ...next, healthRecords: [record, ...next.healthRecords], lastConfirmedInboxId: id };
      });
      notify('已确认并加入健康记录');
      setEditingInboxId(null);
      return;
    }
    if (item.proposedAction === 'create_schedule') {
      const schedule: ScheduleItem = { id: uid('schedule'), title: String(payload.title || '新日程'), date: String(payload.date || TODAY), time: String(payload.time || '10:00'), detail: '收件箱 · 提前 10 分钟提醒', color: 'orange', done: false };
      setData((current) => {
        const nextSchedules = [...current.schedules, schedule];
        const next = withInboxEvent(current, { type: 'confirm', itemId: id, resultEntityId: schedule.id, timestamp: localStamp(), id: uid('audit') });
        return { ...next, schedules: nextSchedules, lastConfirmedInboxId: id };
      });
      pushReminders([...data.schedules, schedule], data.recurringRules);
      notify('已确认并加入日程');
      setEditingInboxId(null);
      return;
    }
    applyButlerAction({ type: item.proposedAction, payload } as ButlerAction);
    setData((current) => {
      const next = withInboxEvent(current, { type: 'confirm', itemId: id, resultEntityId: String(payload.id || 'memory'), timestamp: localStamp(), id: uid('audit') });
      return { ...next, lastConfirmedInboxId: null };
    });
    setEditingInboxId(null);
  }
  function undoLastInboxConfirm() {
    const item = data.inboxItems.find((entry) => entry.id === data.lastConfirmedInboxId);
    if (!canUndoInboxConfirm(item) || !item?.resultEntityId) { notify('最近一次确认不能撤销'); return; }
    setData((current) => {
      const deleted = current.transactions.find((transaction) => transaction.id === item.resultEntityId);
      const removed = removePostedTransaction(current.accounts, current.transactions, item.resultEntityId as string);
      const next = withInboxEvent(current, { type: 'undo', itemId: item.id, timestamp: localStamp(), id: uid('audit') });
      const recurringRules = deleted
        ? releaseRecurringConfirmation(current.recurringRules, removed.transactions, deleted)
        : reconcileRecurringConfirmations(current.recurringRules, removed.transactions);
      return {
        ...next,
        accounts: removed.accounts,
        transactions: removed.transactions,
        recurringRules,
        lastConfirmedInboxId: null,
      };
    });
    notify('已撤销最近一次入账，条目回到待确认');
  }
  function queueButlerActions(actions: ButlerAction[]) {
    if (!actions.length) return;
    setData((current) => {
      let next = current;
      for (const action of actions) {
        next = withInboxEvent(next, { type: 'enqueue', item: inboxItemFromButlerAction({ id: uid('inbox'), createdAt: localStamp(), action }), timestamp: localStamp(), id: uid('audit') });
      }
      return next;
    });
    notify(`管家建议已放入收件箱（${actions.length} 条），确认后才会写入`);
  }
  function queueAiTools(tools: Parameters<typeof inboxItemFromAiTool>[0]['tool'][]) {
    const items = tools.flatMap((tool) => {
      const item = inboxItemFromAiTool({ id: uid('inbox'), createdAt: localStamp(), tool });
      return item ? [item] : [];
    });
    if (!items.length) return;
    setData((current) => {
      let next = current;
      for (const item of items) {
        next = withInboxEvent(next, { type: 'enqueue', item, timestamp: localStamp(), id: uid('audit') });
      }
      return next;
    });
    notify(`管家建议已放入收件箱（${items.length} 条），确认后才会写入`);
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
  function importGadgetbridgeHealth() {
    const native = (window as Window & { SelfAgentNative?: { importGadgetbridge?: () => void } }).SelfAgentNative;
    if (native?.importGadgetbridge) native.importGadgetbridge();
    else notify('请在 Android App 中连接 Gadgetbridge 数据库或 ZIP');
  }
  function importHealthConnect() {
    const native = (window as Window & { SelfAgentNative?: { importHealthConnect?: () => void } }).SelfAgentNative;
    if (native?.importHealthConnect) native.importHealthConnect();
    else notify('请在 Android App 中授权并同步 Health Connect');
  }
  function chooseGadgetbridgeExport() {
    const native = (window as Window & { SelfAgentNative?: { chooseGadgetbridgeExport?: () => void } }).SelfAgentNative;
    if (native?.chooseGadgetbridgeExport) native.chooseGadgetbridgeExport();
    else notify('请在 Android App 中选择 Gadgetbridge.zip 所在文件夹');
  }
  function exportHealthDiagnostics() {
    const native = (window as Window & { SelfAgentNative?: { exportHealthDiagnostics?: () => void } }).SelfAgentNative;
    if (native?.exportHealthDiagnostics) native.exportHealthDiagnostics();
    else notify('请在 Android App 中导出健康诊断日志');
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
      return { ...current, investments };
    });
    setEditingHoldingId(null); setSheet(null); setSelectedAccountId(accountId); notify(previous ? '持仓与今日净值已更新' : '理财产品已添加');
  }
  function deleteHolding() {
    const selected = editingHoldingId ? data.investments.find((item) => item.id === editingHoldingId) : undefined;
    if (!selected || !window.confirm('确定删除这个理财产品吗？历史收益记录也会删除。')) return;
    setData((current) => { const investments = current.investments.filter((item) => item.id !== selected.id); return { ...current, investments }; });
    setEditingHoldingId(null); setSelectedHoldingId(null); setSheet(null); notify('理财产品已删除');
  }
  function togglePrivacy(key: keyof PrivacySettings) { setData((current) => ({ ...current, privacy: { ...current.privacy, [key]: !current.privacy[key] } })); }
  function toggleMemory(id: string) { setData((current) => ({ ...current, memories: current.memories.map((item) => item.id === id ? { ...item, active: !item.active, updatedAt: localStamp() } : item) })); }
  function toggleMemorySend(id: string) { setData((current) => ({ ...current, memories: current.memories.map((item) => item.id === id ? { ...item, sendAllowed: !item.sendAllowed, updatedAt: localStamp() } : item) })); }
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
      const accountId = String(action.payload.accountId || '');
      const currency = String(action.payload.currency || '');
      if (!accountId || !currency || typeof action.payload.reimbursable !== 'boolean') { notify('请先在收件箱补全账户、币种和是否报销'); return; }
      if (!data.accounts.some((item) => item.id === accountId && item.currency === currency)) { notify('入账账户无效'); return; }
      saveTransaction({ kind: 'expense', amount: action.payload.amount, merchant: action.payload.merchant, category: action.payload.category || '其他', accountId, source: action.payload.source || '管家草稿确认', currency: currency as Currency, reimbursable: action.payload.reimbursable });
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
    const json = JSON.stringify(safe, null, 2);
    const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative;
    if (native?.exportBackup) {
      native.exportBackup(json);
      notify('请选择保存位置。账本与健康是明文，不含密码和 API 密钥');
      return;
    }
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); link.download = `self-agent-data-${TODAY}.json`; link.click(); URL.revokeObjectURL(link.href); notify('已导出本机数据。密码和 API 密钥不包含在内，账本与健康记录是明文');
  }
  function applyImportedBackup(raw: unknown) {
    if (!isBackupPayload(raw)) { notify('备份格式不正确，现有数据未改变'); return; }
    if (!window.confirm('导入将替换当前日程、账本和设置，是否继续？')) return;
    setData(normalizeData(raw as Partial<AppData>));
    notify('备份已恢复，可以重新查看和编辑');
  }
  async function importLocalData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      applyImportedBackup(JSON.parse(await file.text()) as unknown);
    } catch { notify('无法读取备份，现有数据未改变'); }
  }
  function pickNativeBackup() {
    const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative;
    if (!native?.importBackup) { notify('请在 Android App 中选择备份文件'); return; }
    native.importBackup();
  }
  function loadDemoData() {
    const hasData = data.schedules.length + data.transactions.length + data.accounts.length > 0;
    if (hasData && !window.confirm('加载演示数据会替换当前记录，是否继续？')) return;
    setData(demoData); notify('已加载演示数据，页面会持续显示演示标识');
  }
  function clearLocalData() {
    if (!window.confirm('确定清空本机日程、账本、健康、行程和 AI 设置吗？密码库不会被清空。')) return;
    setData(emptyData); setAiConfig(emptyAi); window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(AI_CONFIG_STORAGE_KEY); window.sessionStorage.removeItem(AI_CONFIG_STORAGE_KEY); const native = (window as Window & { SelfAgentNative?: NativeAiBridge }).SelfAgentNative; native?.clearAiConfig?.(); native?.clearReminders?.(); pushReminders([], [], false); notify('本机业务数据已清空');
  }
  function openPermissionSettings(id: PermissionCardId, secondary = false) {
    const native = (window as Window & { SelfAgentNative?: { openNotificationAccess?: () => void; openAccessibilitySettings?: () => void; openAutofillSettings?: () => void; importHealthConnect?: () => void; openReminderSettings?: () => void } }).SelfAgentNative;
    setData((current) => ({ ...current, permissionOnboarding: markPermissionSettingsOpened(current.permissionOnboarding) }));
    if (!native) { notify('请在 Android App 中开启系统权限'); return; }
    if (id === 'payment') (secondary ? native.openAccessibilitySettings : native.openNotificationAccess)?.();
    if (id === 'reminders') native.openReminderSettings?.();
    if (id === 'health') native.importHealthConnect?.();
    if (id === 'autofill') native.openAutofillSettings?.();
  }
  function finishPermissionOnboarding() {
    setData((current) => ({ ...current, permissionOnboarding: dismissPermissionOnboarding(current.permissionOnboarding, localStamp()) }));
    setPermissionOnboardingOpen(false);
  }
  function pageTitle() { return tab === 'schedule' ? '日程与行动' : tab === 'capture' ? '记录' : tab === 'finance' ? selectedHoldingId ? '收益详情' : selectedAccountId ? '账户账单' : '我的财务' : tab === 'profile' ? '我的' : tab === 'life' ? '生活' : tab === 'health' ? '健康记录' : tab === 'travel' ? '我的出行' : tab === 'data' ? '数据中心' : tab === 'butler' ? '本机管家' : tab === 'privacy' ? '隐私与权限' : tab === 'memory' ? '记忆管理' : tab === 'vault' ? '密码库' : tab === 'audit' ? '操作历史' : '首页'; }

  return <AppShell theme={data.theme}>
    {permissionOnboardingOpen && <PermissionOnboardingPanel caps={caps} nativeOn={nativeOn} onOpen={openPermissionSettings} onLater={finishPermissionOnboarding} />}
    {investmentPlans[0] && <div className="overlay" role="dialog" aria-modal="true" aria-label="理财余额确认"><form className="sheet" onSubmit={(event) => event.preventDefault()}><div className="handle" /><header><div><span>INVESTMENT MIGRATION</span><h2>旧余额代表什么</h2></div></header><p className="form-tip">{data.accounts.find((item) => item.id === investmentPlans[0].accountId)?.name || '理财账户'} 旧余额 {currencyMark(investmentPlans[0].currency as Currency)}{money(investmentPlans[0].oldBalance)} · 持仓市值 {currencyMark(investmentPlans[0].currency as Currency)}{money(investmentPlans[0].marketValue)} · 差额 {currencyMark(investmentPlans[0].currency as Currency)}{money(investmentPlans[0].inferredDelta)}</p><div className="native-actions"><button type="button" onClick={() => confirmInvestmentMeaning(investmentPlans[0].accountId, 'cash')}>是现金</button><button type="button" onClick={() => confirmInvestmentMeaning(investmentPlans[0].accountId, 'market')}>是持仓市值</button><button type="button" onClick={() => confirmInvestmentMeaning(investmentPlans[0].accountId, 'total')}>是现金加市值</button></div></form></div>}
    <AppHeader title={pageTitle()} onBack={() => { if (!goBack()) notify('已经在首页'); }} onSettings={() => navigate('profile')} />

    {tab === 'home' && <HomePage
      demoMode={data.demoMode}
      todayLabel={TODAY_LABEL}
      greeting={GREETING}
      inboxPending={inboxPending.slice(0, 3).map((item) => ({
        id: item.id,
        preview: item.preview,
        sourceLabel: inboxSourceLabel(item.source),
        actionLabel: INBOX_ACTION_LABELS[item.proposedAction],
        confidenceLabel: inboxConfidenceLabel(item.confidence),
      }))}
      inboxPendingCount={inboxPendingCount}
      hasBusinessData={hasBusinessData}
      hasFinanceData={hasFinanceData}
      nativeOn={nativeOn}
      caps={caps}
      todaySchedules={schedulesOnDate(data.schedules, TODAY).map((item) => ({ id: item.id, time: item.time, title: item.title, detail: item.detail }))}
      todaySpendLabel={hideMoney(`¥ ${money(todaySpend)}`, data.hideAmounts)}
      netWorthLabel={hideMoney(totalBalanceLabel, data.hideAmounts)}
      recentCount={recentTransactions.length}
      recentLedger={<TransactionList hideAmounts={data.hideAmounts} items={recentTransactions} accounts={data.accounts} onEdit={(id) => { setEditingTransactionId(id); setSheet('transaction'); }} onDelete={(id) => deleteTransaction(id)} onSettle={(id) => settleReimbursement(id)} />}
      onClearDemo={clearLocalData}
      onNavigate={(id) => navigate(id)}
      onAddFirstSchedule={() => { setEditingScheduleId(null); navigate('schedule'); setSheet('schedule'); }}
      onAddFirstAccount={() => { navigate('finance'); setEditingAccountId(null); setSheet('account'); }}
    />}

    {tab === 'schedule' && <SchedulePage
      today={TODAY}
      selectedDate={selectedDate}
      schedules={data.schedules}
      editing={editingSchedule}
      formOpen={sheet === 'schedule'}
      onSelectDate={setSelectedDate}
      onNew={() => { setEditingScheduleId(null); setSheet('schedule'); }}
      onEdit={(id) => { setEditingScheduleId(id); setSheet('schedule'); }}
      onCloseForm={() => { setSheet(null); setEditingScheduleId(null); }}
      onSubmit={addSchedule}
      onToggle={toggleSchedule}
      onDelete={deleteSchedule}
    />}

    {tab === 'capture' && <RecordsPage
      captureText={captureText}
      onCaptureText={setCaptureText}
      onOrganize={organizeCapture}
      onVoice={startVoiceCapture}
      onImage={pickCaptureImage}
      items={inboxPending}
      accounts={data.accounts}
      editingId={editingInboxId}
      canUndo={canUndoInboxConfirm(lastConfirmedInbox)}
      onEdit={setEditingInboxId}
      onPatch={patchInboxPayload}
      onConfirm={confirmInbox}
      onIgnore={ignoreInbox}
      onUndo={undoLastInboxConfirm}
    />}

    {tab === 'finance' && <FinancePage data={data} currency={financeCurrency} selectedAccountId={selectedAccountId} selectedHoldingId={selectedHoldingId} onCurrency={setFinanceCurrency} onSelectAccount={(id) => { setSelectedAccountId(id); setSelectedHoldingId(null); }} onSelectHolding={setSelectedHoldingId} onBackAccount={() => setSelectedAccountId(null)} onBackHolding={() => setSelectedHoldingId(null)} onNewTransaction={() => { setEditingTransactionId(null); setSheet('transaction'); }} onEditTransaction={(id) => { setEditingTransactionId(id); setSheet('transaction'); }} onNewAccount={() => { setEditingAccountId(null); setSheet('account'); }} onEditAccount={(id) => { setEditingAccountId(id); setSheet('account'); }} onNewHolding={() => { setEditingHoldingId(null); setSheet('holding'); }} onEditHolding={(id) => { setEditingHoldingId(id); setSheet('holding'); }} onNewRecurring={() => { setEditingRecurringId(null); setSheet('recurring'); }} onEditRecurring={(id) => { setEditingRecurringId(id); setSheet('recurring'); }} onDeleteRecurring={(id) => deleteRecurringRule(id)} onDeleteTransaction={(id) => deleteTransaction(id)} onRunRecurring={runRecurringRule} onSettleReimbursement={settleReimbursement} onSettleAccount={settleAccount} onNewRate={() => { setEditingRateCurrency(null); setSheet('exchange-rate'); }} onEditRate={(currency) => { setEditingRateCurrency(currency); setSheet('exchange-rate'); }} onDeleteRate={deleteExchangeRate} onRefreshQuotes={requestQuoteRefresh} hideAmounts={data.hideAmounts} onToggleHideAmounts={() => setData((current) => ({ ...current, hideAmounts: !current.hideAmounts }))} />}

    {tab === 'profile' && <ProfilePage theme={data.theme} nativeOn={nativeOn} aiConfig={aiConfig} onNavigate={navigate} onOpenPermissions={() => setPermissionOnboardingOpen(true)} onChooseZip={chooseGadgetbridgeExport} onSaveAi={saveAiConfig} onTestAi={() => void testAiConnection()} onOpenAccessibility={() => (window as Window & { SelfAgentNative?: { openAccessibilitySettings?: () => void } }).SelfAgentNative?.openAccessibilitySettings?.()} onOpenNotification={() => (window as Window & { SelfAgentNative?: { openNotificationAccess?: () => void } }).SelfAgentNative?.openNotificationAccess?.()} onOpenAutofill={() => (window as Window & { SelfAgentNative?: { openAutofillSettings?: () => void } }).SelfAgentNative?.openAutofillSettings?.()} onToggleTheme={toggleTheme} onExport={exportLocalData} onImport={importLocalData} onNativeImport={pickNativeBackup} onLoadDemo={loadDemoData} onClear={clearLocalData} />}
    {tab === 'life' && <LifePage onNavigate={navigate} />}
    {tab === 'health' && <HealthPage records={data.healthRecords} onAdd={() => setSheet('health')} onImportHealthConnect={importHealthConnect} onImportGadgetbridge={importGadgetbridgeHealth} onSelectExport={chooseGadgetbridgeExport} onExportDiagnostics={exportHealthDiagnostics} onSaveBody={saveBodyMetrics} />}
    {tab === 'travel' && <TravelPage items={data.travels} onSync={requestTravelSync} onAdd={() => setSheet('travel')} onDelete={(id) => { setData((current) => ({ ...current, travels: current.travels.filter((item) => item.id !== id) })); notify('行程已删除'); }} />}
    {tab === 'data' && <DataPage data={data} />}
    {tab === 'butler' && <ButlerPage data={data} ai={aiConfig} onQueueActions={queueButlerActions} onQueueTools={queueAiTools} />}
    {tab === 'privacy' && <PrivacyPage settings={data.privacy} onToggle={togglePrivacy} />}
    {tab === 'memory' && <MemoryPage items={data.memories} onToggle={toggleMemory} onToggleSend={toggleMemorySend} onDelete={deleteMemory} />}
    {tab === 'vault' && <VaultPage items={nativeOn && vaultMeta.length ? vaultMeta : data.vaultItems} nativeOn={nativeOn} onReveal={(id) => (window as Window & { SelfAgentNative?: { revealPassword?: (id: string) => void } }).SelfAgentNative?.revealPassword?.(id)} />}
    {tab === 'audit' && <AuditPage entries={data.auditLog} />}

    <BottomNav active={primaryNavActiveId(tab)} onChange={(id) => navigate(id)} badge={inboxPendingCount} hidden={tab === 'capture' && Boolean(editingInboxId)} />

    {sheet === 'transaction' && <TransactionComposer accounts={data.accounts} currency={financeCurrency} editing={editingTransaction} onClose={() => setSheet(null)} onSubmit={addTransaction} onDelete={() => deleteTransaction(editingTransaction?.id)} />}
    {sheet === 'account' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingAccount?.id ?? 'new-account'} onSubmit={addAccount} className="sheet"><div className="handle" /><header><div><span>{editingAccount ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</span><h2>{editingAccount ? '编辑账户' : '添加自定义账户'}</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><label>账户名称<input required autoFocus name="name" placeholder="例如：港币旅行卡" defaultValue={editingAccount?.name} /></label><div className="row"><label>账户类型<select name="type" defaultValue={editingAccount?.type}>{accountTypes.map((type) => <option key={type} value={type}>{type}{accountRole(type) === 'receivable' ? ' · 债务应收' : isDebtRole(accountRole(type)) ? ' · 债务应付' : ''}</option>)}</select></label><label>币种<select name="currency" defaultValue={editingAccount?.currency}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div><label>{editingAccount && isDebtRole(accountRole(editingAccount.type)) ? '当前欠款' : accountRole(editingAccount?.type || '') === 'receivable' ? '应收余额' : '当前余额'}<input name="balance" type="number" step="0.01" defaultValue={editingAccount?.balance ?? 0} /></label><small className="form-tip">{editingAccount && isDebtRole(accountRole(editingAccount.type)) ? '欠款和信用卡是债务·应付，填你还欠多少。' : accountRole(editingAccount?.type || '') === 'receivable' ? '待收回是债务·应收，别人欠你的钱。报销不用单独开账户。' : '新建时填写期初余额；已有账户改余额会生成一笔「余额调整」流水，不会直接改期初。'}</small><button className="save" type="submit">{editingAccount ? '保存修改' : '保存账户'}</button>{editingAccount && <button className="danger-button" type="button" onClick={() => deleteAccount(editingAccount.id)}>删除这个账户</button>}</form></div>}
    {sheet === 'settle-account' && settlingAccount && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={settlingAccount.id} onSubmit={confirmAccountSettlement} className="sheet"><div className="handle" /><header><div><span>SETTLE ACCOUNT</span><h2>{isDebtRole(accountRole(settlingAccount.type)) ? '还多少、用哪个账户' : '收回多少、进哪个账户'}</h2></div><button type="button" onClick={() => { setSheet(null); setSettlingAccountId(null); }}>×</button></header><p className="form-tip">{settlingAccount.name} 当前{isDebtRole(accountRole(settlingAccount.type)) ? '欠款' : '应收'} {currencyMark(settlingAccount.currency)} {money(settlingAccount.balance)}</p><label>{isDebtRole(accountRole(settlingAccount.type)) ? '还款金额' : '收回金额'}<input required name="amount" type="number" min="0.01" max={settlingAccount.balance} step="0.01" defaultValue={settlingAccount.balance} /></label><label>{isDebtRole(accountRole(settlingAccount.type)) ? '用哪个资金账户还' : '收到哪个资金账户'}<select name="counterpartId" defaultValue={defaultCashId(data.accounts, settlingAccount.currency)}>{data.accounts.filter((account) => canHoldMoney(account) && account.currency === settlingAccount.currency && account.id !== settlingAccount.id).map((account) => <option key={account.id} value={account.id}>{account.name} · 余额 {currencyMark(account.currency)}{money(account.balance)}</option>)}</select></label><small className="form-tip">{isDebtRole(accountRole(settlingAccount.type)) ? '不会自动还清。你填多少、选哪个账户，就从那个账户扣多少。' : '不会自动全部收回。你填多少、选哪个账户，钱就进那个账户。'}</small><button className="save" type="submit">{isDebtRole(accountRole(settlingAccount.type)) ? '确认还款' : '确认收回'}</button></form></div>}
    {sheet === 'settle-reimbursement' && settlingTransactionId && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form onSubmit={confirmReimbursementSettlement} className="sheet"><div className="handle" /><header><div><span>SETTLE REIMBURSEMENT</span><h2>报销到账：填金额和对方账户</h2></div><button type="button" onClick={() => { setSheet(null); setSettlingTransactionId(null); }}>×</button></header><label>到账金额（{settlingReimbursement?.currency}）<input required name="amount" type="number" min="0.01" step="0.01" defaultValue={settlingReimbursement?.amount} /></label><label>打入哪个资金账户<select name="counterpartId" defaultValue={defaultCashId(data.accounts, settlingReimbursement?.currency ?? financeCurrency)}>{data.accounts.filter((account) => canHoldMoney(account) && account.currency === settlingReimbursement?.currency).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label><small className="form-tip">按账户实际应收金额结清；这是现金流结算，不会记成月度收入。</small><button className="save" type="submit">确认收回</button></form></div>}
    {sheet === 'recurring' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingRecurring?.id ?? 'new-bill'} onSubmit={addRecurringRule} className="sheet scroll-sheet"><div className="handle" /><header><div><span>{editingRecurring ? 'EDIT BILL' : 'NEW BILL'}</span><h2>{editingRecurring ? '编辑每月账单' : '添加每月账单'}</h2></div><button type="button" onClick={() => { setSheet(null); setEditingRecurringId(null); }}>×</button></header><div className="row"><label>规则类型<select name="ruleKind" defaultValue={editingRecurring?.kind ?? 'subscription'}><option value="subscription">订阅扣款</option><option value="credit-card">信用卡还款</option></select></label><label>每月到期日<input name="dueDay" type="number" min="1" max="31" defaultValue={editingRecurring?.dueDay ?? 1} /></label></div><label>名称<input required name="name" placeholder="例如：视频会员" defaultValue={editingRecurring?.name} /></label><div className="row"><label>金额<input required name="amount" type="number" min="0.01" step="0.01" defaultValue={editingRecurring?.amount} /></label><label>币种<select name="currency" defaultValue={editingRecurring?.currency}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label></div><label>扣款账户<select name="accountId" defaultValue={editingRecurring?.accountId}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label><label>还款目标账户（订阅可忽略）<select name="targetAccountId" defaultValue={editingRecurring?.targetAccountId}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>{editingRecurring && <button type="button" className="rule-toggle" onClick={() => toggleRecurringRule(editingRecurring.id)}>{editingRecurring.enabled ? '暂停这条提醒' : '重新启用提醒'}</button>}<button className="save" type="submit">{editingRecurring ? '保存修改' : '保存账单'}</button>{editingRecurring && <button className="danger-button" type="button" onClick={() => deleteRecurringRule(editingRecurring.id)}>删除这条账单</button>}</form></div>}
    {sheet === 'exchange-rate' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingRateCurrency ?? 'new-rate'} onSubmit={addExchangeRate} className="sheet"><div className="handle" /><header><div><span>EXCHANGE RATE</span><h2>人民币汇率</h2></div><button type="button" onClick={() => { setSheet(null); setEditingRateCurrency(null); }}>×</button></header><label>原币种<select name="currency" defaultValue={editingRateCurrency ?? 'USD'}>{currencies.filter((currency) => currency !== 'CNY').map((currency) => <option key={currency}>{currency}</option>)}</select></label><label>1 单位原币 = 人民币<input required name="cnyRate" type="number" min="0.000001" step="0.000001" defaultValue={editingRateCurrency ? data.exchangeRates.find((item) => item.currency === editingRateCurrency)?.cnyRate : ''} placeholder="例如 USD 填 7.200000" /></label><label>适用日期<input required name="asOf" type="date" defaultValue={editingRateCurrency ? data.exchangeRates.find((item) => item.currency === editingRateCurrency)?.asOf : TODAY} /></label><small className="form-tip">仅保存你手动确认的汇率；不会联网编造行情。缺失汇率的币种不会计入人民币总额。</small><button className="save" type="submit">保存手动汇率</button>{editingRateCurrency && <button className="danger-button" type="button" onClick={() => { deleteExchangeRate(editingRateCurrency); setEditingRateCurrency(null); setSheet(null); }}>删除此汇率</button>}</form></div>}
    {sheet === 'health' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form onSubmit={addHealthRecord} className="sheet"><div className="handle" /><header><div><span>HEALTH RECORD</span><h2>添加健康记录</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>记录类型<select name="kind"><option value="height">身高 cm</option><option value="weight">体重 kg</option><option value="heartRate">心率 次/分</option><option value="stress">压力</option><option value="sleep">睡眠小时</option><option value="pai">PAI</option><option value="exercise">运动分钟</option><option value="meal">饮食餐数</option></select></label><label>数值<input required name="value" type="number" min="0" step="0.1" /></label></div><label>备注<input name="note" placeholder="例如：晨起心率、昨晚睡眠" /></label><small className="form-tip">管家只会在健康权限打开时读取这些数值，不等于诊断。</small><button className="save" type="submit">保存记录</button></form></div>}
    {sheet === 'travel' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form onSubmit={addTravel} className="sheet scroll-sheet"><div className="handle" /><header><div><span>NEW TRIP</span><h2>手动添加行程</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>类型<select name="kind"><option value="train">火车</option><option value="flight">航班</option></select></label><label>车次 / 航班号<input required name="number" placeholder="例如：G11" /></label></div><div className="row"><label>出发地<input required name="from" /></label><label>目的地<input required name="to" /></label></div><label>出发时间<input required name="departAt" type="datetime-local" /></label><label>到达时间<input required name="arriveAt" type="datetime-local" /></label><div className="row"><label>座位<input name="seat" placeholder="06车 08A" /></label><label>航站楼 / 检票口<input name="terminal" placeholder="T2 / 12A" /></label></div><button className="save" type="submit">保存行程</button></form></div>}
    {sheet === 'holding' && <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && setSheet(null)}><form key={editingHolding?.id ?? 'new-holding'} onSubmit={addHolding} className="sheet scroll-sheet"><div className="handle" /><header><div><span>{editingHolding ? 'EDIT ASSET' : 'NEW ASSET'}</span><h2>{editingHolding ? '更新理财产品' : '添加理财产品'}</h2></div><button type="button" onClick={() => setSheet(null)}>×</button></header><div className="row"><label>产品类型<select name="kind" defaultValue={editingHolding?.kind ?? 'fund'}><option value="fund">基金 / ETF</option><option value="stock">股票</option><option value="crypto">虚拟货币</option><option value="meme">Meme 币</option></select></label><label>所属账户<select name="accountId" defaultValue={editingHolding?.accountId ?? selectedAccountId ?? undefined}>{data.accounts.filter((account) => account.type === '理财账户').map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label></div><label>产品名称<input required name="name" placeholder="例如：标普500 ETF" defaultValue={editingHolding?.name} /></label><label>基金 / 股票 / 币种代码<input name="code" placeholder="例如：510300.SH、AAPL、BTC" defaultValue={editingHolding?.code} /></label><div className="row"><label>网络<select name="network" defaultValue={editingHolding?.network}><option value="">非链上产品</option><option>Ethereum</option><option>Solana</option><option>BNB Chain</option><option>Base</option><option>Arbitrum</option><option>Polygon</option></select></label><label>合约地址<input name="contract" placeholder="Meme 币必填" defaultValue={editingHolding?.contract} /></label></div><div className="row"><label>持有数量<input required name="quantity" type="number" min="0" step="any" defaultValue={editingHolding?.quantity} /></label><label>平均成本<input required name="averageCost" type="number" min="0" step="any" defaultValue={editingHolding?.averageCost} /></label></div><label>当前价格 / 今日净值<input required name="currentPrice" type="number" min="0" step="any" defaultValue={editingHolding?.currentPrice} /></label><small className="form-tip">保存会形成今日收益点。连接行情服务后，App 可按代码或“网络 + 合约”每日自动更新。</small><button className="save" type="submit">{editingHolding ? '保存今日更新' : '添加产品'}</button>{editingHolding && <button className="danger-button" type="button" onClick={deleteHolding}>删除这个产品</button>}</form></div>}
    {toast && <div className="toast" role="status" aria-live={TOAST_ARIA_LIVE}>✓ {toast}</div>}
  </AppShell>;
}

function PermissionOnboardingPanel({ caps, nativeOn, onOpen, onLater }: { caps: CapabilityStatusSnapshot; nativeOn: boolean; onOpen: (id: PermissionCardId, secondary?: boolean) => void; onLater: () => void }) {
  const cards = permissionOnboardingProgress(caps);
  const enabled = cards.filter((card) => card.enabled).length;
  return <div className="permission-onboarding" role="dialog" aria-modal="true" aria-label="系统权限引导"><div className="permission-onboarding-shell">
    <header><span>START SELF AGENT</span><h2>让 Self Agent 开始工作</h2><p>无需一次全部开启。每项由 Android 系统授权，打开设置页不等于授权成功，回来后会自动复查。</p><b>{nativeOn ? `已检测 ${enabled}/${cards.length}` : '网页版仅展示说明，请在 Android App 授权'}</b></header>
    <div className="permission-onboarding-list">{cards.map((card) => <article key={card.id} className={card.enabled ? 'enabled' : ''}><div className="permission-state">{card.enabled ? '✓ 已开启' : '○ 未检测到'}</div><h3>{card.title}</h3><p><strong>为什么需要：</strong>{card.why}</p><p><strong>可以读取：</strong>{card.reads}</p><p><strong>不会读取：</strong>{card.cannotRead}</p><div><button type="button" onClick={() => onOpen(card.id)}>{card.id === 'health' ? '选择健康授权' : '打开系统设置'}</button>{card.id === 'payment' && <button type="button" className="ghost" onClick={() => onOpen(card.id, true)}>打开无障碍</button>}</div></article>)}</div>
    <footer><button type="button" className="later" onClick={onLater}>稍后设置</button><button type="button" className="done" onClick={onLater}>完成并进入</button></footer>
  </div></div>;
}

