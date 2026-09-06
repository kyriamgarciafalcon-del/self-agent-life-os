export function dayOffsetFromToday(date: string, today: string): number {
  const from = Date.parse(`${date}T00:00:00`);
  const to = Date.parse(`${today}T00:00:00`);
  return Math.round((from - to) / 86_400_000);
}

export function formatMonthDay(date: string): string {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return `${month}月${day}日`;
}

export function schedulesOnOffset<T extends { date: string; time: string }>(items: T[], date: string): T[] {
  return items.filter((item) => item.date === date).sort((left, right) => left.time.localeCompare(right.time));
}
