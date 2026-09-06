import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';

const emptyLedger = {
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
  auditLog: [{
    id: 'audit-1',
    timestamp: '2026-09-06T10:00:00+08:00',
    outcome: 'confirmed',
    source: 'ai',
    action: 'create_schedule',
    itemId: 'inbox-1',
    summary: '管家草稿已确认写入日程',
    dataScope: 'schedule',
  }],
  lastConfirmedInboxId: null,
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: null, settingsOpened: false },
  inboxItems: [],
};

async function overflowX(page, selector) {
  return page.locator(selector).evaluate((el) => el.scrollWidth - el.clientWidth);
}

async function shortControls(page, selector) {
  return page.evaluate((sel) => [...document.querySelectorAll(`${sel} button, ${sel} a, ${sel} [role="button"]`)]
    .filter((button) => {
      const box = button.getBoundingClientRect();
      return box.height > 0 && box.width > 0 && (box.height < 44 || box.width < 44);
    })
    .map((button) => (button.textContent || button.getAttribute('aria-label') || '').trim()), selector);
}

test('375px butler, audit and data routes use Apple surfaces without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: emptyLedger });
  await page.goto('/');

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: /生活/ }).click();
  await page.getByRole('button', { name: /^管家 / }).click();

  const butler = page.locator('.butler-page');
  await expect(butler).toBeVisible();
  await expect(butler.getByRole('heading', { name: '本机管家' })).toBeVisible();
  await expect(butler.getByText('收件箱')).toBeVisible();
  await expect(butler.getByText('密码域不会发给 AI')).toBeVisible();
  await expect(butler.getByRole('button', { name: '发送' })).toBeVisible();
  await expect(butler.getByText('模拟解锁')).toHaveCount(0);
  expect(await overflowX(page, '.butler-page')).toBe(0);
  expect(await shortControls(page, '.butler-page')).toEqual([]);

  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: /操作历史/ }).click();

  const audit = page.locator('.audit-page');
  await expect(audit).toBeVisible();
  await expect(audit.getByRole('heading', { name: '操作历史' })).toBeVisible();
  await expect(audit.getByLabel('筛选操作结果')).toBeVisible();
  await expect(audit.getByLabel('筛选操作来源')).toBeVisible();
  await expect(audit.getByText('管家草稿已确认写入日程')).toBeVisible();
  expect(await overflowX(page, '.audit-page')).toBe(0);
  expect(await shortControls(page, '.audit-page')).toEqual([]);

  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: /数据中心/ }).click();

  const data = page.locator('.data-page');
  await expect(data).toBeVisible();
  await expect(data.getByRole('heading', { name: '数据中心' })).toBeVisible();
  await expect(data.getByText('统一摘要')).toBeVisible();
  await expect(data.getByText('健康评分')).toHaveCount(0);
  await expect(data.getByText('评分趋势')).toHaveCount(0);
  await expect(data.getByText('+200ml')).toHaveCount(0);
  expect(await overflowX(page, '.data-page')).toBe(0);
  expect(await shortControls(page, '.data-page')).toEqual([]);
});
