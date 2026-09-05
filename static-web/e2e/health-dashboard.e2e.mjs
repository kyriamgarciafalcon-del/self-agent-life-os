import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'self-agent:local-data:v1';
const healthData = {
  schemaVersion: 4,
  demoMode: false,
  accounts: [], transactions: [], recurringRules: [], schedules: [], travels: [], investments: [], exchangeRates: [], memories: [], vaultItems: [], inboxItems: [], auditLog: [],
  healthRecords: [
    { id: 'steps-1', kind: 'steps', value: 4300, note: 'Gadgetbridge · 步数', createdAt: '2026-09-01T20:00:00+08:00', externalKey: 'gadgetbridge:2026-09-01:steps' },
    { id: 'steps-2', kind: 'steps', value: 7100, note: 'Gadgetbridge · 步数', createdAt: '2026-09-04T21:00:00+08:00', externalKey: 'gadgetbridge:2026-09-04:steps' },
    { id: 'sleep-1', kind: 'sleep', value: 6.5, note: 'Gadgetbridge · 主睡眠', createdAt: '2026-09-03T08:00:00+08:00', externalKey: 'gadgetbridge:2026-09-03:sleep' },
    { id: 'sleep-2', kind: 'sleep', value: 7.2, note: 'Gadgetbridge · 主睡眠', createdAt: '2026-09-04T08:00:00+08:00', externalKey: 'gadgetbridge:2026-09-04:sleep' },
    { id: 'heart-1', kind: 'heartRate', value: 68, note: 'Health Connect · 心率', createdAt: '2026-09-04T07:30:00+08:00', externalKey: 'health-connect:2026-09-04:heartRate' },
    { id: 'stress-1', kind: 'stress', value: 34, note: 'Gadgetbridge · 压力', createdAt: '2026-09-04T21:00:00+08:00' },
    { id: 'pai-1', kind: 'pai', value: 42, note: 'Gadgetbridge · PAI', createdAt: '2026-09-04T21:00:00+08:00' },
    { id: 'height', kind: 'height', value: 165, note: '身体资料 · 身高', createdAt: '2026-09-04T09:00:00+08:00', externalKey: 'manual:profile:height' },
    { id: 'weight', kind: 'weight', value: 45, note: '身体资料 · 体重', createdAt: '2026-09-04T09:00:00+08:00', externalKey: 'manual:profile:weight' },
  ],
  privacy: { health: true, finance: false, schedule: false, memory: false },
  theme: 'light', lastConfirmedInboxId: null,
  permissionOnboarding: { version: 2, dismissed: true, completedAt: null, settingsOpened: false },
};

test('health dashboard presents real metrics, sources and editable body profile', async ({ page }) => {
  await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: healthData });
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /生活$/ }).click();
  await page.getByRole('button', { name: /健康/ }).click();

  await expect(page.getByRole('heading', { name: '今日状态' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '7 日趋势' })).toBeVisible();
  const status = page.getByRole('region', { name: '今日健康状态' });
  await expect(status).toContainText('7100');
  await expect(status).toContainText('7小时12分钟');
  await expect(status.locator('.sleep-duration .sleep-number')).toHaveText(['7', '12']);
  await expect(status.locator('.sleep-duration .sleep-unit')).toHaveText(['小时', '分钟']);
  await expect(status).toContainText('68');
  await expect(page.locator('.health-trend-point')).toHaveCount(2);

  await page.locator('.health-metric-tabs').getByRole('tab', { name: '睡眠' }).click();
  await expect(page.locator('.health-trend-summary')).toContainText('7小时12分钟');
  await expect(page.locator('.health-trend-point').last()).toContainText('7时12分');
  await expect(page.locator('.health-trend-summary')).toContainText('Gadgetbridge');
  await expect(page.locator('.health-trend-point')).toHaveCount(2);

  const management = page.locator('.health-data-management');
  await expect(management.getByRole('button', { name: /Health Connect/ })).toBeVisible();
  await expect(management.getByRole('button', { name: /^G Gadgetbridge/ })).toBeVisible();
  await expect(management.getByRole('button', { name: /导出导入排障/ })).toContainText('不是医疗诊断');

  const body = page.locator('.health-body-panel');
  await expect(body).toContainText('165 cm');
  await expect(body).toContainText('45 kg');
  await expect(body.getByRole('spinbutton')).toHaveCount(0);
  await body.getByRole('button', { name: '修改' }).click();
  await expect(body.getByRole('spinbutton')).toHaveCount(2);
  await body.getByLabel('体重（kg）').fill('46');
  await body.getByRole('button', { name: '保存身体资料' }).click();
  await expect(body).toContainText('46 kg');

  await expect(page.getByText('手环原始分 · 无医学单位')).toHaveCount(2);
  await expect(page.getByText('健康评分')).toHaveCount(0);
});
