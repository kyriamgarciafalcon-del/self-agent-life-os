import { readFileSync } from 'node:fs';
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

function emptyLedger(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test('reminder bridge source still saves through addSchedule and syncReminders', () => {
  const page = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
  expect(page).toContain('onSubmit={addSchedule}');
  expect(page).toContain('pushReminders');
  expect(page).toContain('syncReminders');
  expect(page).toContain('提前 10 分钟');
});

test('375px schedule empty state, segments, and native reminder bridge on save', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.SelfAgentNative = {
      syncReminders(json) {
        window.__reminderPayloads = window.__reminderPayloads || [];
        window.__reminderPayloads.push(JSON.parse(json));
        return JSON.stringify({ scheduled: 2, notifications: true });
      },
    };
  }, { key: STORAGE_KEY, value: emptyLedger() });
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '日程' }).click();

  const schedule = page.locator('.schedule-page');
  await expect(schedule).toBeVisible();
  await expect(schedule.getByRole('button', { name: '昨天' })).toBeVisible();
  await expect(schedule.getByRole('button', { name: '今天' })).toBeVisible();
  await expect(schedule.getByRole('button', { name: '明天' })).toBeVisible();
  await expect(schedule.getByRole('button', { name: '前一天' })).toBeVisible();
  await expect(schedule.getByRole('button', { name: '后一天' })).toBeVisible();
  await expect(schedule.getByText('这一天没有日程')).toBeVisible();

  const overflow = await page.evaluate(() => {
    const node = document.querySelector('.schedule-page');
    return node ? node.scrollWidth > document.documentElement.clientWidth : true;
  });
  expect(overflow).toBe(false);
  const shortActions = await page.evaluate(() => [...document.querySelectorAll('.schedule-page button')]
    .filter((button) => {
      const box = button.getBoundingClientRect();
      return box.height > 0 && box.height < 44;
    })
    .map((button) => (button.textContent || '').trim().slice(0, 24)));
  expect(shortActions).toEqual([]);

  await page.getByRole('button', { name: '新建日程' }).click();
  await page.getByLabel('日程名称').fill('桥接提醒会议与跨部门项目同步安排');
  await page.locator('input[name="time"]').fill('23:50');
  await page.getByRole('button', { name: '确认添加' }).click();
  await expect(schedule.getByText('桥接提醒会议与跨部门项目同步安排')).toBeVisible();
  const populatedLayout = await page.evaluate(() => {
    const root = document.querySelector('.schedule-page');
    const short = [...document.querySelectorAll('.schedule-page button')].filter((button) => {
      const box = button.getBoundingClientRect();
      return box.height > 0 && box.height < 44;
    }).length;
    return { overflow: root ? root.scrollWidth > document.documentElement.clientWidth : true, short };
  });
  expect(populatedLayout).toEqual({ overflow: false, short: 0 });

  const payloads = await page.evaluate(() => window.__reminderPayloads || []);
  expect(payloads.length).toBeGreaterThan(0);
  expect(payloads.some((payload) => Array.isArray(payload.schedules) && payload.schedules.some((item) => item.title === '桥接提醒会议与跨部门项目同步安排'))).toBe(true);

  await schedule.getByRole('button', { name: '标记完成 桥接提醒会议与跨部门项目同步安排' }).click();
  const completed = await page.evaluate((key) => {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return saved.schedules?.find((item) => item.title === '桥接提醒会议与跨部门项目同步安排')?.done;
  }, STORAGE_KEY);
  expect(completed).toBe(true);
  const afterComplete = await page.evaluate(() => window.__reminderPayloads || []);
  expect(afterComplete.at(-1)?.schedules?.some((item) => item.title === '桥接提醒会议与跨部门项目同步安排')).toBe(false);

  await schedule.getByRole('button', { name: '恢复未完成 桥接提醒会议与跨部门项目同步安排' }).click();
  const afterRestore = await page.evaluate(() => window.__reminderPayloads || []);
  expect(afterRestore.at(-1)?.schedules?.some((item) => item.title === '桥接提醒会议与跨部门项目同步安排')).toBe(true);
  await schedule.getByRole('button', { name: '删除 桥接提醒会议与跨部门项目同步安排' }).click();
  await expect(schedule.getByText('桥接提醒会议与跨部门项目同步安排')).toHaveCount(0);
  const afterDelete = await page.evaluate(() => window.__reminderPayloads || []);
  expect(afterDelete.at(-1)?.schedules?.some((item) => item.title === '桥接提醒会议与跨部门项目同步安排')).toBe(false);
});

test('375px records confirm loop does not write until confirm and can undo', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const ledger = emptyLedger({
    accounts: [
      { id: 'cash', name: '测试资金', type: '资金账户', currency: 'CNY', balance: 500, openingBalance: 500, tone: 'forest' },
    ],
    inboxItems: [{
      id: 'pay-loop',
      source: 'payment',
      confidence: 0.94,
      proposedAction: 'create_expense',
      status: 'pending',
      createdAt: shanghaiStamp(12),
      payload: { amount: 36.8, merchant: '微信支付', category: '餐饮', currency: 'CNY', accountId: 'cash', reimbursable: false },
      preview: '微信支付 · 36.8',
    }],
  });
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: ledger });
  await page.goto('/');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /记录$/ }).click();

  const records = page.locator('.capture-page');
  await expect(records).toBeVisible();
  await expect(records.locator('.inbox-kind')).toHaveText('财务');
  await expect(records.locator('.inbox-card-source')).toContainText('支付通知');
  await expect(records.locator('.inbox-card-amount')).toHaveText('CNY 36.80');
  await expect(records.getByRole('button', { name: '忽略' })).toBeVisible();
  await expect(records.getByRole('button', { name: '确认入账' })).toBeVisible();

  const before = await page.evaluate((key) => {
    const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
    return { tx: saved.transactions?.length || 0, balance: saved.accounts?.[0]?.balance };
  }, STORAGE_KEY);
  expect(before).toEqual({ tx: 0, balance: 500 });

  const overflow = await page.evaluate(() => {
    const node = document.querySelector('.capture-page');
    return node ? node.scrollWidth > document.documentElement.clientWidth : true;
  });
  expect(overflow).toBe(false);

  await records.getByRole('button', { name: '确认入账' }).click();
  await expect(records.locator('.inbox-card')).toHaveCount(0);
  await expect.poll(async () => page.evaluate((key) => {
    const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
    return saved.transactions?.some((item) => item.accountId === 'cash' && item.amount === 36.8) && saved.accounts?.[0]?.balance === 463.2;
  }, STORAGE_KEY)).toBe(true);

  await records.getByRole('button', { name: '撤销最近一次入账' }).click();
  await expect(records.locator('.inbox-card')).toHaveCount(1);
  await expect.poll(async () => page.evaluate((key) => {
    const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
    return {
      tx: saved.transactions?.length || 0,
      hasReversal: saved.transactions?.some((item) => item.reversesId),
      balance: saved.accounts?.[0]?.balance,
      pending: saved.inboxItems?.some((item) => item.id === 'pay-loop' && item.status === 'pending'),
    };
  }, STORAGE_KEY)).toEqual({ tx: 2, hasReversal: true, balance: 500, pending: true });
});
