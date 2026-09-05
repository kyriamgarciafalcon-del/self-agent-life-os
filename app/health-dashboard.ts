export type HealthDashboardRecord = {
  kind: string;
  value: number;
  createdAt?: string;
  note?: string;
  externalKey?: string;
};

export type HealthCoreKind = 'steps' | 'sleep' | 'heartRate' | 'stress' | 'pai';

export type HealthTrendPoint = {
  date: string;
  value: number;
};

export type HealthMetricLatest = {
  value: number;
  date: string;
  createdAt: string;
  source: string;
};

export type HealthMetricSeries = {
  kind: HealthCoreKind;
  label: string;
  unit: string;
  latest: HealthMetricLatest | null;
  displayValue: string;
  points: HealthTrendPoint[];
};

const METRIC_META: Record<HealthCoreKind, { label: string; unit: string }> = {
  steps: { label: '步数', unit: '步' },
  sleep: { label: '睡眠', unit: '' },
  heartRate: { label: '心率', unit: '次/分' },
  stress: { label: '压力', unit: '' },
  pai: { label: 'PAI', unit: '' },
};

export function healthRecordDateKey(createdAt?: string): string {
  if (!createdAt) return '';
  const match = createdAt.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

export function sleepDurationParts(value: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.round(value * 60));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

export function formatSleepDuration(value: number): string {
  const { hours, minutes } = sleepDurationParts(value);
  return `${hours}小时${minutes}分钟`;
}

export function formatCompactSleepDuration(value: number): string {
  const { hours, minutes } = sleepDurationParts(value);
  return `${hours}时${minutes}分`;
}

function formatMetricValue(kind: HealthCoreKind, value: number): string {
  return kind === 'sleep' ? formatSleepDuration(value) : String(value);
}

function healthRecordSource(record: HealthDashboardRecord): string {
  const evidence = `${record.externalKey || ''} ${record.note || ''}`.toLowerCase();
  if (evidence.includes('gadgetbridge')) return 'Gadgetbridge';
  if (evidence.includes('health-connect') || evidence.includes('health connect')) return 'Health Connect';
  if (evidence.includes('manual:') || evidence.includes('身体资料')) return '手动记录';
  return '本机';
}

export function buildHealthMetricSeries(records: HealthDashboardRecord[], kind: HealthCoreKind): HealthMetricSeries {
  const meta = METRIC_META[kind];
  const byDate = new Map<string, HealthDashboardRecord>();
  for (const record of records) {
    if (record.kind !== kind || !Number.isFinite(record.value)) continue;
    const date = healthRecordDateKey(record.createdAt);
    if (!date) continue;
    const previous = byDate.get(date);
    if (!previous || String(record.createdAt || '').localeCompare(String(previous.createdAt || '')) >= 0) {
      byDate.set(date, record);
    }
  }
  const points = Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
    .map(([date, record]) => ({ date, value: record.value }));
  const latestPoint = points.at(-1);
  const latestRecord = latestPoint ? byDate.get(latestPoint.date) : undefined;
  return {
    kind,
    label: meta.label,
    unit: meta.unit,
    latest: latestPoint && latestRecord
      ? {
          value: latestPoint.value,
          date: latestPoint.date,
          createdAt: latestRecord.createdAt || latestPoint.date,
          source: healthRecordSource(latestRecord),
        }
      : null,
    displayValue: latestPoint ? formatMetricValue(kind, latestPoint.value) : '暂无数据',
    points,
  };
}
