import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const data = {
  schemaVersion: 4,
  demoMode: false,
  schedules: [],
  accounts: [
    { id: 'cash', name: '日常资金', type: '资金账户', balance: 1000, currency: 'CNY', tone: 'forest' },
    { id: 'invest', name: '理财账户', type: '理财账户', balance: 200, currency: 'CNY', tone: 'ink' },
  ],
  transactions: [
    { id: 'meal', kind: 'expense', amount: 30, accountAmount: 30, currency: 'CNY', merchant: '午餐', category: '餐饮', accountId: 'cash', source: '手动记录', reimbursable: false, createdAt: `${today}T12:00:00`, occurredAt: `${today}T12:00:00`, status: 'confirmed' },
  ],
  recurringRules: [{ id: 'bill', name: '云盘', kind: 'subscription', amount: 20, currency: 'CNY', accountId: 'cash', dueDay: 1, enabled: true }],
  healthRecords: [], travels: [], memories: [], vaultItems: [], inboxItems: [], auditLog: [], lastConfirmedInboxId: null,
  investments: [{ id: 'fund', accountId: 'invest', kind: 'fund', name: '指数基金', code: '510300.SH', contract: '', network: '', quantity: 10, averageCost: 8, currentPrice: 10, currency: 'CNY', updatedAt: today, quoteStatus: 'live', history: [{ date: today, price: 10 }] }],
  exchangeRates: [{ currency: 'USD', cnyRate: 7.1, asOf: today, source: 'daily', updatedAt: `${today}T18:00:00` }],
  privacy: { health: false, finance: false, schedule: false, memory: false }, theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: today, settingsOpened: false },
};

test.use({ viewport: { width: 375, height: 812 } });

test('375px finance keeps five sections and ledger-backed account actions', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: data });
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /财务/ }).click();
  await page.waitForTimeout(250);

  const tabs = page.getByRole('tablist', { name: '财务分类' });
  await expect(tabs.getByRole('tab')).toHaveCount(5);
  await expect(page.getByText('净资产', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '手动汇率' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '每日更新' })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建流水' })).toBeVisible();

  await tabs.getByRole('tab', { name: '账户' }).click();
  await expect(page.getByRole('button', { name: '编辑 理财账户' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看 理财账户 的账单' })).toBeVisible();
  await expect(page.getByText(/现金.*200\.00.*市值.*100\.00/)).toBeVisible();

  await tabs.getByRole('tab', { name: '投资' }).click();
  await expect(page.getByText('指数基金')).toBeVisible();
  await tabs.getByRole('tab', { name: '周期账单' }).click();
  await expect(page.getByText('云盘')).toBeVisible();
  await tabs.getByRole('tab', { name: '流水' }).click();
  await expect(page.getByText('午餐')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
