import { describe, expect, it } from 'vitest';
import { buildHealthMetricSeries, formatSleepDuration } from '../app/health-dashboard.ts';

describe('buildHealthMetricSeries', () => {
  it('keeps the last finite value on the same day and drops NaN', () => {
    const series = buildHealthMetricSeries([
      { kind: 'steps', value: 1000, createdAt: '2026-09-01T08:00:00+08:00' },
      { kind: 'steps', value: 3200, createdAt: '2026-09-01T21:00:00+08:00', externalKey: 'gadgetbridge:2026-09-01:steps' },
      { kind: 'steps', value: Number.NaN, createdAt: '2026-09-01T22:00:00+08:00' },
      { kind: 'sleep', value: 7, createdAt: '2026-09-01T07:00:00+08:00' },
    ], 'steps');

    expect(series.kind).toBe('steps');
    expect(series.label).toBe('步数');
    expect(series.unit).toBe('步');
    expect(series.latest?.value).toBe(3200);
    expect(series.latest?.date).toBe('2026-09-01');
    expect(series.latest?.source).toBe('Gadgetbridge');
    expect(series.displayValue).toBe('3200');
    expect(series.points).toEqual([{ date: '2026-09-01', value: 3200 }]);
  });

  it('sorts dates and keeps at most the latest 7 real days without padding zeros', () => {
    const records = [
      { kind: 'sleep', value: 6, createdAt: '2026-09-10' },
      { kind: 'sleep', value: 7, createdAt: '2026-09-02' },
      { kind: 'sleep', value: 5, createdAt: '2026-09-03' },
      { kind: 'sleep', value: 8, createdAt: '2026-08-20' },
      { kind: 'sleep', value: 6.5, createdAt: '2026-09-04' },
      { kind: 'sleep', value: 7.1, createdAt: '2026-09-05' },
      { kind: 'sleep', value: 6.8, createdAt: '2026-09-07' },
      { kind: 'sleep', value: 7.4, createdAt: '2026-09-08' },
      { kind: 'sleep', value: 6.2, createdAt: '2026-09-09' },
    ];
    const series = buildHealthMetricSeries(records, 'sleep');
    expect(series.points.map((point) => point.date)).toEqual([
      '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
    ]);
    expect(series.points.map((point) => point.value)).toEqual([5, 6.5, 7.1, 6.8, 7.4, 6.2, 6]);
    expect(series.points).not.toContainEqual(expect.objectContaining({ date: '2026-09-06' }));
    expect(series.latest?.value).toBe(6);
    expect(series.unit).toBe('');
    expect(series.displayValue).toBe('6小时0分钟');
  });

  it('formats decimal sleep hours as hours and minutes', () => {
    const series = buildHealthMetricSeries([
      { kind: 'sleep', value: 7.2, createdAt: '2026-09-11T07:00:00+08:00' },
    ], 'sleep');
    expect(series.displayValue).toBe('7小时12分钟');
    expect(formatSleepDuration(0)).toBe('0小时0分钟');
    expect(formatSleepDuration(0.5)).toBe('0小时30分钟');
    expect(formatSleepDuration(1.999)).toBe('2小时0分钟');
    expect(formatSleepDuration(-1)).toBe('0小时0分钟');
  });

  it('shows 暂无数据 when there are no finite points and does not invent zeros', () => {
    const series = buildHealthMetricSeries([
      { kind: 'steps', value: Number.NaN, createdAt: '2026-09-01' },
      { kind: 'sleep', value: 7, createdAt: '2026-09-01' },
    ], 'steps');
    expect(series.displayValue).toBe('暂无数据');
    expect(series.latest).toBeNull();
    expect(series.points).toEqual([]);
    expect(series.points).not.toContainEqual(expect.objectContaining({ value: 0 }));
  });
});
