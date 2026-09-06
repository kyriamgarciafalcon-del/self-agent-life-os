import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';

function shanghaiStamp(hour) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, '0')}:00:00`;
}

function shanghaiDateKey() {
  return shanghaiStamp(9).slice(0, 10);
}

const homeLedger = {
  schemaVersion: 4,
  demoMode: false,
  accounts: [
    { id: 'cash', name: '测试资金', type: '资金账户', currency: 'CNY', balance: 20_000, openingBalance: 20_000, tone: 'forest' },
  ],
  transactions: [
    { id: 'meal', kind: 'expense', currency: 'CNY', amount: 36, accountAmount: 36, accountId: 'cash', merchant: '午餐', category: '餐饮', source: 'e2e', reimbursable: false, createdAt: shanghaiStamp(11) },
  ],
  recurringRules: [],
  schedules: [
    { id: 's1', date: shanghaiDateKey(), time: '15:00', title: '整理季度预算', detail: '专注时间', color: 'blue', done: false },
  ],
  healthRecords: [],
  travels: [],
  investments: [],
  exchangeRates: [],
  memories: [],
  privacy: { health: false, finance: false, schedule: false, memory: false },
  vaultItems: [],
  auditLog: [],
  lastConfirmedInboxId: null,
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: null, settingsOpened: false },
  inboxItems: [{
    id: 'pay-home',
    source: 'payment',
    confidence: 0.9,
    proposedAction: 'create_expense',
    status: 'pending',
    createdAt: shanghaiStamp(12),
    payload: { amount: 12, merchant: '咖啡', category: '餐饮', currency: 'CNY', accountId: 'cash', reimbursable: false },
    preview: '咖啡 · 12',
  }],
};

test('home hierarchy is large-title plus 今日概况 without mock pulse cards', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: homeLedger });
  await page.goto('/');

  const home = page.locator('.home-page');
  await expect(home.locator('.large-title')).toBeVisible();
  await expect(home.locator('.large-title')).toContainText('所有内容先整理、确认后再保存。');
  await expect(home.locator('.hero-card')).toHaveCount(0);
  await expect(home.getByRole('heading', { name: '今日概况' })).toBeVisible();
  await expect(home).toContainText('整理季度预算');
  await expect(home).toContainText('今日支出');
  await expect(home).toContainText('净资产');
  await expect(home).not.toContainText('本月收入');
  await expect(home.getByRole('heading', { name: '快速记录' })).toBeVisible();
  await expect(home.getByRole('heading', { name: '生活工具' })).toBeVisible();
  await expect(home.getByRole('heading', { name: '最近入账' })).toBeVisible();
  await expect(home.getByText('QUICK CAPTURE')).toHaveCount(0);
  await expect(home.getByText('FEATURES', { exact: true })).toHaveCount(0);
  await expect(home.getByText('RECENT', { exact: true })).toHaveCount(0);
  await expect(home).toContainText('待确认');
  await expect(home.getByText('账本脉搏')).toHaveCount(0);
  await expect(home.getByText('健康一览')).toHaveCount(0);
  await expect(home.locator('.pulse-card')).toHaveCount(0);

  const overflow = await page.evaluate(() => {
    const node = document.querySelector('.home-page');
    return node ? node.scrollWidth > document.documentElement.clientWidth : true;
  });
  expect(overflow).toBe(false);

  const shortActions = await page.evaluate(() => [...document.querySelectorAll('.home-page button')]
    .filter((button) => button.getBoundingClientRect().height > 0 && button.getBoundingClientRect().height < 44)
    .map((button) => (button.textContent || '').trim().slice(0, 24)));
  expect(shortActions).toEqual([]);
});
