import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addLocalDays, formatDateCN, localISODate, weekOptions } from './local-date.ts';

describe('localISODate', () => {
  it('uses the device calendar date, not UTC', () => {
    assert.equal(localISODate(new Date(2026, 7, 28, 23, 30, 0)), '2026-08-28');
  });

  it('does not freeze the product on 2026-08-28', () => {
    assert.equal(localISODate(new Date(2026, 8, 6, 8, 0, 0)), '2026-09-06');
  });
});

describe('addLocalDays', () => {
  it('crosses a month boundary', () => {
    assert.equal(addLocalDays('2026-08-31', 1), '2026-09-01');
    assert.equal(addLocalDays('2026-03-01', -1), '2026-02-28');
  });

  it('crosses a year boundary', () => {
    assert.equal(addLocalDays('2026-01-01', -1), '2025-12-31');
    assert.equal(addLocalDays('2025-12-31', 1), '2026-01-01');
  });
});

describe('formatDateCN', () => {
  it('labels the weekday from the local calendar date', () => {
    assert.equal(formatDateCN('2026-01-01'), '1月1日 · 星期四');
    assert.equal(formatDateCN('2026-08-28'), '8月28日 · 星期五');
  });
});

describe('weekOptions', () => {
  it('keeps Monday–Sunday around a year boundary', () => {
    const days = weekOptions('2026-01-01');
    assert.equal(days.length, 7);
    assert.equal(days[0]?.value, '2025-12-29');
    assert.equal(days[0]?.weekday, '一');
    assert.equal(days[3]?.value, '2026-01-01');
    assert.equal(days[6]?.value, '2026-01-04');
    assert.equal(days[6]?.weekday, '日');
  });

  it('keeps Monday–Sunday around a month boundary', () => {
    const days = weekOptions('2026-09-01');
    assert.equal(days[0]?.value, '2026-08-31');
    assert.equal(days[1]?.value, '2026-09-01');
    assert.equal(days[6]?.value, '2026-09-06');
  });
});
