import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDaysKey } from '../app/product-logic';
import { dayOffsetFromToday, formatMonthDay, schedulesOnOffset } from '../app/components/daily/schedule';
import { inboxKindLabel, inboxConfirmLabel } from '../app/components/daily/records';

describe('schedule daily logic', () => {
  it('maps yesterday/today/tomorrow offsets and formats the day label', () => {
    expect(dayOffsetFromToday('2026-09-06', '2026-09-06')).toBe(0);
    expect(dayOffsetFromToday('2026-09-05', '2026-09-06')).toBe(-1);
    expect(dayOffsetFromToday('2026-09-07', '2026-09-06')).toBe(1);
    expect(formatMonthDay('2026-09-06')).toBe('9月6日');
    expect(addDaysKey('2026-09-06', 1)).toBe('2026-09-07');
  });

  it('lists only the selected day, sorted by time', () => {
    expect(schedulesOnOffset([
      { id: 't', date: '2026-09-06', time: '15:00', title: '今天' },
      { id: 'y', date: '2026-09-05', time: '09:00', title: '昨天' },
      { id: 'm', date: '2026-09-06', time: '08:00', title: '早' },
    ], '2026-09-06').map((item) => item.id)).toEqual(['m', 't']);
  });
});

describe('records daily logic', () => {
  it('uses Chinese kind and confirm labels without writing on ignore', () => {
    expect(inboxKindLabel('create_expense')).toBe('财务');
    expect(inboxKindLabel('create_schedule')).toBe('日程');
    expect(inboxKindLabel('create_health')).toBe('健康');
    expect(inboxKindLabel('create_travel')).toBe('出行');
    expect(inboxConfirmLabel('create_expense')).toBe('确认入账');
    expect(inboxConfirmLabel('create_schedule')).toBe('确认写入');
  });
});

describe('schedule and records source', () => {
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const schedule = readFileSync(new URL('../app/components/daily/SchedulePage.tsx', import.meta.url), 'utf8');
  const records = readFileSync(new URL('../app/components/daily/RecordsPage.tsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../app/components/daily/daily.css', import.meta.url), 'utf8');

  it('extracts schedule UI and still saves through addSchedule + native reminders', () => {
    expect(page).toContain("from './components/daily/SchedulePage'");
    expect(page).toContain('<SchedulePage');
    expect(page).toContain('onSubmit={addSchedule}');
    expect(page).toContain('onToggle={toggleSchedule}');
    expect(page).toContain('function toggleSchedule');
    expect(page).toContain('pushReminders');
    expect(page).toContain('提前 10 分钟');
    expect(page).not.toMatch(/\{tab === 'schedule' && <div className="page schedule-page">/);
    expect(schedule).toContain('昨天');
    expect(schedule).toContain('今天');
    expect(schedule).toContain('明天');
    expect(schedule).toContain('前一天');
    expect(schedule).toContain('后一天');
    expect(schedule).toContain('这一天没有日程');
    expect(schedule).toContain('新建日程');
    expect(schedule).toContain('编辑日程');
    expect(schedule).toContain('daily-segment');
    expect(schedule).toContain('daily-timeline');
  });

  it('extracts records UI onto pendingInboxItems with edit, confirm, ignore and undo', () => {
    expect(page).toContain("from './components/daily/RecordsPage'");
    expect(page).toContain('<RecordsPage');
    expect(page).toContain('onConfirm={confirmInbox}');
    expect(page).toContain('onIgnore={ignoreInbox}');
    expect(page).toContain('onUndo={undoLastInboxConfirm}');
    expect(page).not.toMatch(/\{tab === 'capture' && <div className="page capture-page">/);
    expect(records).toContain('没有待确认记录');
    expect(records).toContain('忽略');
    expect(records).toContain('确认入账');
    expect(records).toContain('确认写入');
    expect(records).toContain('aria-label="币种"');
    expect(records).toContain('inbox-card-amount');
    expect(records).toContain('inbox-card-source');
    expect(records).toContain('撤销最近一次入账');
  });

  it('keeps mint, 44px taps and no iOS blue on daily schedule/records', () => {
    expect(css).toMatch(/\.schedule-page button,|\.schedule-page button\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.capture-page button\{[^}]*min-height:44px/);
    expect(css).toContain('#F2F2F7');
    expect(css).not.toContain('#007AFF');
  });
});
