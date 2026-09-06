import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildHomeOverviewModel } from './home-overview-source.ts';
import { emptyData, normalizeData } from './local-data.ts';

const BUSINESS_ARRAY_KEYS = [
  'schedules',
  'accounts',
  'transactions',
  'recurringRules',
  'healthRecords',
  'travels',
  'investments',
  'memories',
  'vaultItems',
] as const;

const DEMO_MARKERS = [
  'seedData',
  '示例航班',
  '项目周会',
  '午饭后散步',
  '样例账户',
  '恢复示例数据',
  '已恢复示例数据',
  '沪深300ETF（示例）',
  'Apple（示例）',
  'PEPE（示例）',
];

describe('empty first-install data contract', () => {
  it('starts with every business array empty', () => {
    for (const key of BUSINESS_ARRAY_KEYS) {
      assert.deepEqual(emptyData[key], []);
    }
  });

  it('keeps product-safe privacy defaults and light theme', () => {
    assert.deepEqual(emptyData.privacy, { health: false, finance: false, schedule: false });
    assert.equal(emptyData.theme, 'light');
  });

  it('fills missing fields with empty arrays instead of demo records', () => {
    const next = normalizeData({});
    for (const key of BUSINESS_ARRAY_KEYS) {
      assert.deepEqual(next[key], []);
    }
    assert.equal(JSON.stringify(next).includes('项目周会'), false);
    assert.equal(JSON.stringify(next).includes('示例航班'), false);
    assert.deepEqual(next.privacy, { health: false, finance: false, schedule: false });
    assert.equal(next.theme, 'light');
  });

  it('keeps existing localStorage fields and values', () => {
    const next = normalizeData({
      schedules: [{ id: 'user-s', date: '2026-09-06', time: '08:00', title: '真实会议', detail: '本机已有', color: 'blue', done: false }],
      accounts: [{ id: 'cash', name: '现金', type: '资金账户', balance: 12.3, currency: 'CNY', tone: 'forest' }],
      transactions: [{
        id: 'user-t',
        kind: 'expense',
        amount: 9,
        accountAmount: 9,
        currency: 'CNY',
        merchant: '早餐',
        category: '餐饮',
        accountId: 'cash',
        source: '手动记录',
        reimbursable: false,
        createdAt: '2026-09-06T08:10:00+08:00',
      }],
      privacy: { health: false, finance: true, schedule: true },
      theme: 'dark',
    });
    assert.equal(next.schedules[0]?.title, '真实会议');
    assert.equal(next.accounts[0]?.id, 'cash');
    assert.equal(next.accounts[0]?.balance, 12.3);
    assert.equal(next.transactions[0]?.merchant, '早餐');
    assert.deepEqual(next.investments, []);
    assert.deepEqual(next.travels, []);
    assert.deepEqual(next.privacy, { health: false, finance: true, schedule: true });
    assert.equal(next.theme, 'dark');
  });

  it('valuation does not rewrite cash and does not invent accounts', () => {
    const withAccount = normalizeData({
      accounts: [{ id: 'invest-cny', name: '理财', type: '理财账户', balance: 123, currency: 'CNY', tone: 'forest' }],
      investments: [{
        id: 'h1',
        accountId: 'invest-cny',
        kind: 'fund',
        name: '用户持仓',
        code: '510300',
        contract: '',
        network: '',
        quantity: 10,
        averageCost: 1,
        currentPrice: 2,
        currency: 'CNY',
        updatedAt: '2026-09-06',
        quoteStatus: 'manual',
        history: [],
      }],
    });
    assert.equal(withAccount.accounts.length, 1);
    assert.equal(withAccount.accounts[0]?.balance, 123);
    assert.equal(withAccount.investments.length, 1);

    const holdingsOnly = normalizeData({
      investments: [{
        id: 'h1',
        accountId: 'invest-cny',
        kind: 'fund',
        name: '用户持仓',
        code: '510300',
        contract: '',
        network: '',
        quantity: 10,
        averageCost: 1,
        currentPrice: 2,
        currency: 'CNY',
        updatedAt: '2026-09-06',
        quoteStatus: 'manual',
        history: [],
      }],
    });
    assert.deepEqual(holdingsOnly.accounts, []);
    assert.equal(holdingsOnly.investments.length, 1);
  });

  it('yields a real empty homepage model from first-install data', () => {
    const model = buildHomeOverviewModel({
      todayIso: '2026-09-06',
      schedules: emptyData.schedules,
      healthRecords: emptyData.healthRecords,
    });
    assert.equal(model.todayEvents.length, 0);
    assert.equal(model.nextSchedule, null);
    assert.equal(model.healthLatest, null);
    assert.equal(model.netWorth, null);
  });

  it('drops auto-demo values from the page source and clears local data instead of restoring samples', () => {
    const page = readFileSync(path.join(process.cwd(), 'app', 'page.tsx'), 'utf8');
    for (const marker of DEMO_MARKERS) {
      assert.equal(page.includes(marker), false, `page still contains ${marker}`);
    }
    assert.equal(page.includes('emptyData'), true);
    assert.equal(page.includes('清空全部本机数据'), true);
    assert.equal(page.includes('本机数据已清空'), true);
    assert.equal(page.includes('syncInvestmentBalances'), false);
    assert.equal(page.includes('理财余额已更新'), false);
    assert.equal(page.includes('持仓估值已更新'), true);
  });
});
