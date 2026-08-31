import type { AgendaItem, Repeat, Tag } from "./types";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function toDateKey(d: Date | string = new Date()) {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function todayKey() { return toDateKey(new Date()); }
export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(key: string, n: number) {
  const d = parseDateKey(key); d.setDate(d.getDate() + n); return toDateKey(d);
}
export function weekday(key: string) { return parseDateKey(key).getDay(); }
export function mondayOf(key: string) { return addDays(key, -((weekday(key) + 6) % 7)); }
export function dateOnWeekday(from: string, jsDay: number, nextWeek = false) {
  const monday = mondayOf(from);
  const offset = jsDay === 0 ? 6 : jsDay - 1;
  const thisHit = addDays(monday, offset);
  if (nextWeek) return addDays(thisHit, 7);
  if (thisHit >= from) return thisHit;
  return addDays(thisHit, 7);
}
export function monthGrid(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const start = new Date(year, month0, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    return { key: toDateKey(d), inMonth: d.getMonth() === month0, jsDay: d.getDay() };
  });
}
export function occursOn(item: AgendaItem, key: string) {
  if (!item.date) return false;
  if (item.repeat === "none") return item.date === key;
  if (key < item.date) return false;
  if (item.repeat === "daily") return true;
  return weekday(item.date) === weekday(key);
}
export function doneKey(item: AgendaItem, onDate?: string) {
  if (!item.date) return "*";
  if (item.repeat === "none") return item.date;
  return onDate || todayKey();
}
export function isDone(item: AgendaItem, onDate?: string) {
  return item.completedOn.includes(doneKey(item, onDate));
}
export function itemsOn(items: AgendaItem[], key: string) {
  return items.filter((it) => occursOn(it, key)).sort((a, b) => (a.start || "99:99").localeCompare(b.start || "99:99"));
}
export function overdueItems(items: AgendaItem[], today = todayKey()) {
  return items.filter((it) => it.repeat === "none" && it.date && it.date < today && !isDone(it));
}
export function upcomingDays(items: AgendaItem[], today = todayKey(), days = 14) {
  const rows: { key: string; items: AgendaItem[] }[] = [];
  for (let i = 1; i <= days; i++) {
    const key = addDays(today, i);
    const list = itemsOn(items, key);
    if (list.length) rows.push({ key, items: list });
  }
  return rows;
}
export function formatWhen(key: string, today = todayKey()) {
  if (!key) return "未定日期";
  if (key === today) return "今天";
  if (key === addDays(today, 1)) return "明天";
  if (key === addDays(today, 2)) return "后天";
  if (key === addDays(today, -1)) return "昨天";
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日周${WEEK[d.getDay()]}`;
}
export function formatDateLong(key = todayKey()) {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日星期${WEEK[d.getDay()]}`;
}
export function formatMonthTitle(year: number, month0: number) { return `${year}年${month0 + 1}月`; }
export function formatClock(hm: string | null) {
  if (!hm) return "全天";
  const [h, m] = hm.split(":").map(Number);
  const p = h < 6 ? "凌晨" : h < 12 ? "上午" : h < 13 ? "中午" : h < 18 ? "下午" : "晚上";
  const hr = h % 12 || 12;
  return m ? `${p}${hr}:${String(m).padStart(2, "0")}` : `${p}${hr}点`;
}
export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}
export const TAG_LABEL: Record<Tag, string> = { work: "工作", life: "生活", health: "健康" };
export const REPEAT_LABEL: Record<Repeat, string> = { none: "不重复", daily: "每天", weekly: "每周" };
export function tagClass(tag: Tag) {
  if (tag === "work") return "bg-primary";
  if (tag === "health") return "bg-warn";
  return "bg-calm";
}
