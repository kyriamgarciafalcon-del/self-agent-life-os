import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';

function currentStamp(hour) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, '0')}:00:00`;
}

const monthlyLedger = {
  schemaVersion: 3,
  demoMode: false,
  accounts: [
    { id: 'cash', name: '测试资金', type: '资金账户', currency: 'CNY', balance: 20_000, openingBalance: 20_000, tone: 'forest' },
    { id: 'claim', name: '测试待收回', type: '待收回', currency: 'CNY', balance: 300, openingBalance: 300, tone: 'clay' },
    { id: 'card', name: '测试信用卡', type: '信用卡', currency: 'CNY', balance: 600, openingBalance: 600, tone: 'ink' },
  ],
  transactions: [
    { id: 'salary', kind: 'income', currency: 'CNY', amount: 9000, accountAmount: 9000, accountId: 'cash', merchant: '工资', category: '收入', source: 'e2e', reimbursable: false, createdAt: currentStamp(9) },
    { id: 'gift', kind: 'income', currency: 'CNY', amount: 200, accountId: 'cash', merchant: '其他收入', category: '收入', source: 'e2e', reimbursable: false, createdAt: currentStamp(10) },
    { id: 'meal', kind: 'expense', currency: 'CNY', amount: 80, accountAmount: 80, accountId: 'cash', merchant: '午餐', category: '餐饮', source: 'e2e', reimbursable: false, createdAt: currentStamp(11) },
    { id: 'hotel', kind: 'expense', currency: 'CNY', amount: 500, accountAmount: 500, accountId: 'cash', merchant: '差旅垫付', category: '差旅', source: 'e2e', reimbursable: true, reimburseAccountId: 'claim', reimbursed: false, createdAt: currentStamp(12) },
    { id: 'reimbursement', kind: 'settlement', currency: 'CNY', amount: 200, accountAmount: 200, accountId: 'claim', targetAccountId: 'cash', merchant: '部分报销', category: '报销入账', source: 'e2e', reimbursementForId: 'hotel', reimbursable: false, createdAt: currentStamp(13) },
    { id: 'repayment', kind: 'transfer', currency: 'CNY', amount: 600, accountAmount: 600, accountId: 'cash', targetAccountId: 'card', merchant: '信用卡还款', category: '信用卡还款', source: 'e2e', reimbursable: false, createdAt: currentStamp(14) },
    { id: 'legacy-reimbursement', kind: 'income', currency: 'CNY', amount: 300, accountAmount: 300, accountId: 'cash', merchant: '旧报销到账', category: '报销入账', source: 'e2e', reimbursementForId: 'hotel', reimbursable: false, createdAt: currentStamp(15) },
  ],
  recurringRules: [],
  schedules: [],
  healthRecords: [],
  travels: [],
  investments: [],
  exchangeRates: [],
  memories: [],
  privacy: { health: false, finance: false, schedule: false, memory: false },
  vaultItems: [],
  inboxItems: [],
  auditLog: [],
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: null, settingsOpened: false },
};

test('monthly summary excludes reimbursements and account transfers', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: monthlyLedger });

  await page.goto('/');
  const primaryNavigation = page.getByRole('navigation', { name: '主导航' });
  await primaryNavigation.getByRole('button', { name: /财务$/ }).click();

  await expect(page.getByRole('heading', { name: '财务', exact: true })).toBeVisible();
  const summary = page.locator('.monthly-summary');
  const income = summary.locator('article').filter({ hasText: '本月收入' });
  const expense = summary.locator('article').filter({ hasText: '本月支出' });
  const balance = summary.locator('article').filter({ hasText: '本月结余' });
  await expect(income).toContainText('+¥9,200.00');
  await expect(expense).toContainText('−¥580.00');
  await expect(balance).toContainText('+¥8,620.00');
  await expect(summary).not.toContainText('NaN');
});
