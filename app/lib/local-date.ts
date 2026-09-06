export function localISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalISODate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addLocalDays(iso: string, days: number) {
  const date = parseLocalISODate(iso);
  date.setDate(date.getDate() + days);
  return localISODate(date);
}

export function formatDateCN(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = '日一二三四五六'[new Date(year, (month ?? 1) - 1, day ?? 1).getDay()];
  return `${month}月${day}日 · 星期${weekday}`;
}

export function weekOptions(todayIso: string) {
  const today = parseLocalISODate(todayIso);
  const mondayOffset = (today.getDay() + 6) % 7;
  return (['一', '二', '三', '四', '五', '六', '日'] as const).map((weekday, index) => {
    const item = new Date(today);
    item.setDate(today.getDate() - mondayOffset + index);
    return { weekday, day: item.getDate(), value: localISODate(item) };
  });
}
