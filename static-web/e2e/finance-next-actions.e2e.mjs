import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const data = {
  schemaVersion: 4, demoMode: false,
  accounts: [
    { id: 'cash', name: '日常资金', type: '资金账户', balance: 900, openingBalance: 1000, currency: 'CNY', tone: 'forest' },
    { id: 'claim', name: '待收回', type: '待收回', balance: 100, currency: 'CNY', tone: 'clay' },
  ],
  transactions: [],
  recurringRules: [{ id: 'bill', name: '云盘订阅', kind: 'subscription', amount: 30, currency: 'CNY', accountId: 'cash', dueDay: 1, enabled: true }],
  schedules: [], healthRecords: [], travels: [], investments: [], exchangeRates: [], memories: [],
  privacy: { health: false, finance: false, schedule: false, memory: false }, vaultItems: [], auditLog: [], inboxItems: [],
  lastConfirmedInboxId: null, theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: today, settingsOpened: false },
};

test.use({ viewport: { width: 375, height: 812 } });

test('finance overview offers direct next actions without posting a bill early', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: data });
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /财务/ }).click();
  const migration = page.getByRole('dialog', { name: '理财余额确认' });
  if (await migration.count()) await migration.getByRole('button', { name: '是现金', exact: true }).click();
  const overview = page.locator('.finance-tab-panel').first();
  await expect(overview.getByRole('heading', { name: '需要处理' })).toBeVisible();
  await overview.getByRole('button', { name: '查看待收回' }).click();
  await expect(page.getByRole('heading', { name: '待收回' })).toBeVisible();

  await page.getByRole('button', { name: '返回全部账户' }).click();
  await overview.getByRole('button', { name: '生成扣款草稿 · 云盘订阅' }).click();
  await expect(page.locator('.capture-page')).toBeVisible();
  await expect(page.locator('.inbox-card')).toContainText('云盘订阅');
  const posted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}').transactions || [], STORAGE_KEY);
  expect(posted).toHaveLength(0);
});
