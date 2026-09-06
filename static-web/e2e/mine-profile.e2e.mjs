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
  auditLog: [],
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

test('375px 我的 menu uses grouped rows and keeps shipping actions', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: emptyLedger });
  await page.goto('/');

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '我的' }).click();
  const profile = page.locator('.profile-page');
  await expect(profile).toBeVisible();
  await expect(profile.getByRole('heading', { name: '我的' })).toBeVisible();
  await expect(profile.getByText('设置与扩展')).toBeVisible();
  await expect(profile.locator('.sa-group')).toHaveCount(2);
  await expect(profile.getByRole('button', { name: /生活/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /系统权限引导/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /操作历史/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /选择 ZIP 所在文件夹/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /AI 记忆管理/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /隐私与权限/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /密码库/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: /数据中心/ })).toBeVisible();
  await expect(profile.getByRole('button', { name: '保存接口' })).toBeVisible();
  await expect(profile.getByRole('button', { name: '测试连接' })).toBeVisible();
  await expect(profile.getByRole('button', { name: '加载演示数据' })).toBeVisible();
  await expect(profile.getByRole('button', { name: '清空本机数据' })).toBeVisible();
  await expect(profile.getByText('重置演示数据')).toHaveCount(0);
  await expect(profile.getByText('+200ml')).toHaveCount(0);

  const bg = await profile.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(242, 242, 247)');
  expect(await overflowX(page, '.profile-page')).toBe(0);
  expect(await shortControls(page, '.profile-page')).toEqual([]);

  await profile.getByRole('button', { name: /生活/ }).click();
  const life = page.locator('.life-page');
  await expect(life).toBeVisible();
  await expect(life.getByRole('heading', { name: '生活' })).toBeVisible();
  await expect(life.getByRole('button', { name: /健康/ })).toBeVisible();
  await expect(life.getByRole('button', { name: /出行/ })).toBeVisible();
  await expect(life.getByRole('button', { name: /记忆/ })).toBeVisible();
  await expect(life.getByRole('button', { name: /管家/ })).toBeVisible();
  expect(await overflowX(page, '.life-page')).toBe(0);
  expect(await shortControls(page, '.life-page')).toEqual([]);
});
