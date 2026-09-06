import { formatDateCN } from './local-date.ts';

export type HomeHealthKind = 'sleep' | 'meal' | 'exercise';

export type HomeHealthRecord = {
  kind: HomeHealthKind;
  value: number;
  note: string;
  createdAt: string;
};

export type HomeSchedule = {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
  done: boolean;
};

export type HomeSourceInput = {
  todayIso: string;
  schedules: readonly HomeSchedule[];
  healthRecords: readonly HomeHealthRecord[];
  todaySpendCny?: number;
  authoritativeNetWorth?: number;
};

export type HomeOverviewModel = {
  dateLabel: string;
  nextSchedule: { time: string; title: string } | null;
  todayEvents: HomeSchedule[];
  todayDoneCount: number;
  todayTotalCount: number;
  todaySpendCny: number | null;
  netWorth: number | null;
  healthLatest: HomeHealthRecord | null;
  writeAction: 'capture';
};

export function formatHealthValue(record: Pick<HomeHealthRecord, 'kind' | 'value'>) {
  if (record.kind === 'sleep') {
    const totalMinutes = Math.max(0, Math.round(record.value * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}小时${minutes}分钟`;
  }
  if (record.kind === 'exercise') return `${record.value}分钟`;
  return `${record.value}餐`;
}

export function buildHomeOverviewModel(input: HomeSourceInput): HomeOverviewModel {
  const todayEvents = input.schedules
    .filter((item) => item.date === input.todayIso)
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));
  const next = todayEvents.find((item) => !item.done);
  const healthLatest = input.healthRecords.length
    ? [...input.healthRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    : null;

  return {
    dateLabel: formatDateCN(input.todayIso),
    nextSchedule: next ? { time: next.time, title: next.title } : null,
    todayEvents,
    todayDoneCount: todayEvents.filter((item) => item.done).length,
    todayTotalCount: todayEvents.length,
    todaySpendCny: input.todaySpendCny ?? null,
    netWorth: input.authoritativeNetWorth ?? null,
    healthLatest,
    writeAction: 'capture',
  };
}
