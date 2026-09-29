import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const initialData = {
  schemaVersion: 4,
  demoMode: false,
  schedules: [],
  accounts: [{ id: 'wechat', name: '微信零钱', type: '资金账户', balance: 100, openingBalance: 100, currency: 'CNY', tone: 'forest' }],
  transactions: [],
  recurringRules: [],
  investments: [],
  exchangeRates: [],
  healthRecords: [],
  travels: [],
  memories: [],
  privacy: { health: false, finance: false, schedule: false, memory: false },
  vaultItems: [],
  inboxItems: [],
  auditLog: [],
  lastConfirmedInboxId: null,
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: today, settingsOpened: false },
};

test.use({ viewport: { width: 375, height: 812 } });

test('native confirm action posts the captured payment to the ledger', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: initialData });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('self-agent:auto-txn', { detail: {
    id: 'native-event-001', amount: 0.01, title: '微信支付', category: '其他', source: 'wechat',
    accountHint: '微信零钱/银行卡', dir: 'out', autoSave: true,
  } })));

  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return stored.inboxItems?.length || 0;
  }, STORAGE_KEY)).toBe(1);
  const result = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      transactionCount: stored.transactions?.length || 0,
      accountBalance: stored.accounts?.find((item) => item.id === 'wechat')?.balance,
      inboxStatus: stored.inboxItems?.[0]?.status,
    };
  }, STORAGE_KEY);
  expect(result.transactionCount).toBe(1);
  expect(result.accountBalance).toBeCloseTo(99.99, 2);
  expect(result.inboxStatus).toBe('confirmed');
});

test('captured payments stay pending until an explicit confirmation action', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: initialData });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('self-agent:auto-txn', { detail: {
    id: 'native-event-review-only', amount: 2, title: '测试支付', source: 'wechat', dir: 'out', autoSave: false,
  } })));
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return stored.inboxItems?.length || 0;
  }, STORAGE_KEY)).toBe(1);
  const result = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return { transactionCount: stored.transactions?.length || 0, status: stored.inboxItems?.[0]?.status };
  }, STORAGE_KEY);
  expect(result.transactionCount).toBe(0);
  expect(result.status).toBe('pending');
});

test('confirmation without a resolvable account is kept for review, never posted', async ({ page }) => {
  const dataWithoutAccounts = { ...initialData, accounts: [] };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: dataWithoutAccounts });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('self-agent:auto-txn', { detail: {
    id: 'native-event-no-account', amount: 3, title: '测试支付', source: 'wechat', dir: 'out', autoSave: true,
  } })));
  await expect.poll(() => page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return stored.inboxItems?.length || 0;
  }, STORAGE_KEY)).toBe(1);
  const result = await page.evaluate((key) => {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    return { transactionCount: stored.transactions?.length || 0, status: stored.inboxItems?.[0]?.status };
  }, STORAGE_KEY);
  expect(result.transactionCount).toBe(0);
  expect(result.status).toBe('pending');
});
