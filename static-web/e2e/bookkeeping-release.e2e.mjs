import { expect, test } from '@playwright/test';

const key = 'self-agent:local-data:v1';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const previous = new Date(`${today}T12:00:00+08:00`);
previous.setUTCDate(1);
previous.setUTCMonth(previous.getUTCMonth() - 1);
const backDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(previous);
const month = backDate.slice(0, 7);

const data = {
  schemaVersion: 4, demoMode: false, schedules: [],
  accounts: [{ id: 'cash', name: '日常资金', type: '资金账户', balance: 1000, openingBalance: 1000, currency: 'CNY', tone: 'forest' }],
  transactions: [], recurringRules: [], investments: [], exchangeRates: [],
  healthRecords: [], travels: [], memories: [], vaultItems: [], inboxItems: [], auditLog: [], lastConfirmedInboxId: null,
  privacy: { health: false, finance: false, schedule: false, memory: false }, theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: today, settingsOpened: false },
};

test.use({ viewport: { width: 375, height: 812 } });
test('backdated quick expense is discoverable in its month and reversible', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: data });
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /财务/ }).click();
  await page.getByRole('button', { name: '新建流水' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('金额').fill('35');
  await dialog.getByLabel('商家 / 用途').fill('补记午餐');
  await dialog.getByLabel('发生日期').fill(backDate);
  await dialog.getByRole('button', { name: '确认入账' }).click();
  await page.getByRole('tablist', { name: '财务分类' }).getByRole('tab', { name: '流水' }).click();
  await page.getByLabel('账单月份').fill(month);
  await expect(page.getByText('补记午餐')).toBeVisible();
  await expect(page.getByRole('heading', { name: backDate })).toBeVisible();
  await page.getByLabel('搜索流水').fill('不存在的商家');
  await expect(page.getByText('补记午餐')).toHaveCount(0);
  await page.getByLabel('搜索流水').fill('补记午餐');
  await expect(page.getByText('补记午餐')).toBeVisible();
  await expect(page.getByText('本月流水 · CNY')).toHaveCount(0);
  await page.getByRole('tablist', { name: '财务分类' }).getByRole('tab', { name: '总览' }).click();
  await expect(page.locator('.finance-month-grid').first()).toContainText('35.00');
  await expect(page.locator('.finance-month-grid').first()).toContainText(`${month}支出`);
  await page.getByRole('tablist', { name: '财务分类' }).getByRole('tab', { name: '流水' }).click();
  page.once('dialog', (confirm) => confirm.accept());
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('补记午餐')).toHaveCount(0);
  const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), key));
  expect(stored.accounts.find((account) => account.id === 'cash').balance).toBe(1000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
