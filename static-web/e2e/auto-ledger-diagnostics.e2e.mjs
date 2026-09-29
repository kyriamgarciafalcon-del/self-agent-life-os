import { expect, test } from '@playwright/test';

const key = 'self-agent:local-data:v1';
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const data = {
  schemaVersion: 4,
  demoMode: false,
  schedules: [],
  accounts: [],
  transactions: [],
  recurringRules: [],
  investments: [],
  exchangeRates: [],
  healthRecords: [],
  travels: [],
  memories: [],
  vaultItems: [],
  inboxItems: [],
  auditLog: [],
  lastConfirmedInboxId: null,
  privacy: { health: false, finance: false, schedule: false, memory: false },
  theme: 'light',
  permissionOnboarding: { version: 2, dismissed: true, completedAt: date, settingsOpened: false },
};

const diagnostic = {
  active: true,
  serviceStarts: 1,
  accessibilityEvents: 5,
  scans: 3,
  nonEmptyScans: 2,
  matches: 1,
  parsed: 1,
  duplicates: 0,
  notificationsSubmitted: 1,
  lastOutcome: 'notified',
  lastPackage: 'wechat',
  lastEventType: 2048,
  lastTextLength: 64,
  rawText: 'private transaction text',
};

test.use({ viewport: { width: 375, height: 812 } });

test('shows local payment pipeline counters and lets the user reset them', async ({ page }) => {
  await page.addInitScript(({ key, data, diagnostic }) => {
    localStorage.setItem(key, JSON.stringify(data));
    let reset = false;
    let stopped = false;
    window.paymentDiagnosticResetCalled = false;
    window.paymentDiagnosticStopCalled = false;
    window.SelfAgentNative = {
      nativeReady: () => true,
      vaultMeta: () => '[]',
      capabilityStatus: () => JSON.stringify({
        accessibility: true,
        notificationListener: true,
        notifications: true,
        autofill: true,
        paymentCapture: reset ? {
          active: !stopped,
          serviceStarts: 0, accessibilityEvents: 0, scans: 0, nonEmptyScans: 0,
          matches: 0, parsed: 0, duplicates: 0, notificationsSubmitted: 0,
          lastOutcome: 'idle', lastPackage: 'unknown', lastEventType: 0, lastTextLength: 0,
        } : diagnostic,
      }),
      resetPaymentCaptureDiagnostics: () => { reset = true; stopped = false; window.paymentDiagnosticResetCalled = true; },
      stopPaymentCaptureDiagnostics: () => { stopped = true; window.paymentDiagnosticStopCalled = true; },
    };
  }, { key, data, diagnostic });

  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /我的/ }).click();
  await expect(page.getByRole('heading', { name: '自动记账诊断' })).toBeVisible();
  await expect(page.getByText('诊断状态：运行中（最长 10 分钟）')).toBeVisible();
  await expect(page.getByText('微信界面事件：5')).toBeVisible();
  await expect(page.getByText('扫描中读到文字：2')).toBeVisible();
  await expect(page.getByText('规则命中：1')).toBeVisible();
  await expect(page.getByText('通知已提交：1')).toBeVisible();
  await expect(page.getByText('private transaction text')).toHaveCount(0);

  await page.getByRole('button', { name: '清零并开始 10 分钟检测' }).click();
  await expect.poll(() => page.evaluate(() => window.paymentDiagnosticResetCalled)).toBe(true);
  await page.getByRole('button', { name: '停止诊断' }).click();
  await expect.poll(() => page.evaluate(() => window.paymentDiagnosticStopCalled)).toBe(true);
});
