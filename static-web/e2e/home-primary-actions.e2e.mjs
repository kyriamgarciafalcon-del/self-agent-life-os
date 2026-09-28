import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';

test.use({ viewport: { width: 375, height: 812 } });

test('home exposes three direct actions for the primary record workflows', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 4, demoMode: false, accounts: [], transactions: [], recurringRules: [], schedules: [],
    healthRecords: [], travels: [], investments: [], exchangeRates: [], memories: [],
    privacy: { health: false, finance: false, schedule: false, memory: false }, vaultItems: [], auditLog: [],
    inboxItems: [], lastConfirmedInboxId: null, theme: 'light',
    permissionOnboarding: { version: 2, dismissed: true, completedAt: null, settingsOpened: false },
  })), STORAGE_KEY);
  await page.goto('/');
  const actions = page.getByRole('group', { name: '快速操作' });
  await expect(actions.getByRole('button', { name: '记一笔' })).toBeVisible();
  await expect(actions.getByRole('button', { name: '新建日程' })).toBeVisible();
  await expect(actions.getByRole('button', { name: '快速记录' })).toBeVisible();
  await actions.getByRole('button', { name: '记一笔' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: '确认一笔流水' })).toBeVisible();
  await expect(page.getByLabel('发生日期')).toBeVisible();
});
