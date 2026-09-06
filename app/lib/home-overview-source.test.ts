import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildHomeOverviewModel, formatHealthValue } from './home-overview-source.ts';

const empty = {
  todayIso: '2026-09-06',
  schedules: [] as const,
  healthRecords: [] as const,
};

describe('home overview source contract', () => {
  it('does not invent net worth when no authoritative value is provided', () => {
    const model = buildHomeOverviewModel(empty);
    assert.equal(model.netWorth, null);
  });

  it('only surfaces net worth from an authoritative selector', () => {
    const model = buildHomeOverviewModel({ ...empty, authoritativeNetWorth: 12847.75 });
    assert.equal(model.netWorth, 12847.75);
  });

  it('does not expose month income/expense columns', () => {
    const model = buildHomeOverviewModel(empty);
    assert.equal('monthIncome' in model, false);
    assert.equal('monthExpense' in model, false);
  });

  it('keeps homepage writes as capture navigation', () => {
    assert.equal(buildHomeOverviewModel(empty).writeAction, 'capture');
  });

  it('shows the newest real health record and does not fill zeros', () => {
    const model = buildHomeOverviewModel({
      todayIso: '2026-09-06',
      schedules: [],
      healthRecords: [
        { kind: 'exercise', value: 32, note: '快走', createdAt: '2026-08-27T19:20:00+08:00' },
        { kind: 'sleep', value: 6.2, note: '昨晚睡眠', createdAt: '2026-08-28T07:10:00+08:00' },
      ],
    });
    assert.deepEqual(model.healthLatest, {
      kind: 'sleep',
      value: 6.2,
      note: '昨晚睡眠',
      createdAt: '2026-08-28T07:10:00+08:00',
    });
  });

  it('formats sleep as rounded X小时Y分钟 and compact exercise/meal', () => {
    assert.equal(formatHealthValue({ kind: 'sleep', value: 6.2 }), '6小时12分钟');
    assert.equal(formatHealthValue({ kind: 'sleep', value: 6 }), '6小时0分钟');
    assert.equal(formatHealthValue({ kind: 'sleep', value: 0.5 }), '0小时30分钟');
    assert.equal(formatHealthValue({ kind: 'sleep', value: 1.999 }), '2小时0分钟');
    assert.equal(formatHealthValue({ kind: 'exercise', value: 32 }), '32分钟');
    assert.equal(formatHealthValue({ kind: 'meal', value: 1 }), '1餐');
  });

  it('uses a real empty health state instead of a score or trend', () => {
    const model = buildHomeOverviewModel(empty);
    assert.equal(model.healthLatest, null);
    assert.equal('healthScore' in model, false);
    assert.equal('healthTrend' in model, false);
  });

  it('lists only today\'s existing events in time order', () => {
    const model = buildHomeOverviewModel({
      todayIso: '2026-09-06',
      schedules: [
        { id: 'b', date: '2026-09-06', time: '19:30', title: '给妈妈打电话', detail: '个人', done: false },
        { id: 'a', date: '2026-09-06', time: '09:30', title: '项目周会', detail: '线上', done: true },
        { id: 'other', date: '2026-09-07', time: '08:00', title: '明天的事', detail: '工作', done: false },
      ],
      healthRecords: [],
    });
    assert.deepEqual(model.todayEvents.map((item) => item.id), ['a', 'b']);
    assert.equal(model.nextSchedule?.title, '给妈妈打电话');
    assert.equal(model.todayDoneCount, 1);
    assert.equal(model.todayTotalCount, 2);
  });

  it('does not invent today spend; it only echoes a provided total', () => {
    assert.equal(buildHomeOverviewModel(empty).todaySpendCny, null);
    assert.equal(buildHomeOverviewModel({ ...empty, todaySpendCny: 36 }).todaySpendCny, 36);
  });

  it('does not copy attachment pulse naming into the home slice', () => {
    const appDir = path.join(process.cwd(), 'app');
    const page = readFileSync(path.join(appDir, 'page.tsx'), 'utf8');
    const home = readFileSync(path.join(appDir, 'components/home/HomeOverview.tsx'), 'utf8');
    const css = readFileSync(path.join(appDir, 'globals.css'), 'utf8');
    for (const text of [page, home, css]) {
      assert.equal(text.includes('账本脉搏'), false);
      assert.equal(text.includes('健康一览'), false);
      assert.equal(text.includes('pulse-card'), false);
    }
    assert.equal(home.includes('本月收入'), false);
    assert.equal(css.includes('本月收入'), false);
  });
});
