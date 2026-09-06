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

const ledger = {
  schemaVersion: 4,
  demoMode: false,
  accounts: [],
  transactions: [],
  recurringRules: [],
  schedules: [],
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
    id: 'pay-shell',
    source: 'payment',
    confidence: 0.9,
    proposedAction: 'create_expense',
    status: 'pending',
    createdAt: shanghaiStamp(12),
    payload: { amount: 12, merchant: '咖啡', category: '餐饮', currency: 'CNY', reimbursable: false },
    preview: '咖啡 · 12',
  }],
};

test('375px shell nav contract: five tabs, mint, badge, back, life under profile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: ledger });
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: '主导航' });
  await expect(nav.getByRole('button', { name: '首页' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '日程' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '记录' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '财务' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '我的' })).toBeVisible();
  await expect(nav.getByRole('button', { name: '生活' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: '今天' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: '收件箱' })).toHaveCount(0);
  await expect(nav.locator('svg')).toHaveCount(5);
  await expect(nav.locator('.nav-badge')).toHaveText('1');

  const activeColor = await nav.locator('button.active').evaluate((el) => getComputedStyle(el).color);
  expect(activeColor).toBe('rgb(47, 111, 87)');
  expect(activeColor).not.toBe('rgb(0, 122, 255)');

  const shortNav = await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="主导航"] button')]
    .filter((button) => {
      const box = button.getBoundingClientRect();
      return box.height > 0 && (box.height < 44 || box.width < 44);
    })
    .map((button) => (button.textContent || '').trim()));
  expect(shortNav).toEqual([]);

  await nav.getByRole('button', { name: '日程' }).click();
  await expect(page.getByRole('heading', { name: '日程与行动' })).toBeVisible();
  await page.getByRole('button', { name: '返回' }).click();
  await expect(page.locator('.home-page')).toBeVisible();

  await nav.getByRole('button', { name: '记录' }).click();
  await expect(page.locator('.capture-page')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('self-agent:back')));
  await expect(page.locator('.home-page')).toBeVisible();

  await nav.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: /生活/ }).click();
  await expect(page.getByRole('heading', { name: '健康、出行和记忆' })).toBeVisible();
});
