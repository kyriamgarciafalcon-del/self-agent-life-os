export type HomeShortcutId = 'capture' | 'travel' | 'health' | 'butler' | 'data' | 'vault';

export const HOME_SHORTCUTS: { id: HomeShortcutId; title: string; hint: string }[] = [
  { id: 'capture', title: '记录一件事', hint: '例如“午饭 36 元，微信支付”' },
  { id: 'travel', title: '出行', hint: '火车与航班' },
  { id: 'health', title: '健康', hint: '身高体重心率' },
  { id: 'butler', title: '管家', hint: '本机摘要问答' },
  { id: 'data', title: '数据', hint: '统一趋势' },
  { id: 'vault', title: '密码库', hint: '安全元数据' },
];

export function homeHasAuthoritativeData(input: {
  schedules: unknown[];
  accounts: unknown[];
  transactions: unknown[];
  healthRecords: unknown[];
  travels: unknown[];
}): boolean {
  return input.schedules.length + input.accounts.length + input.transactions.length + input.healthRecords.length + input.travels.length > 0;
}

export function schedulesOnDate<T extends { date: string; time: string }>(items: T[], date: string): T[] {
  return items.filter((item) => item.date === date).sort((left, right) => left.time.localeCompare(right.time));
}
