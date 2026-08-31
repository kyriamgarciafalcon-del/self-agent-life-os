import type { Draft, Repeat, Tag } from "./types";
import { addDays, dateOnWeekday, todayKey } from "./agenda";

const WEEKDAY: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
function pad(n: number) { return String(n).padStart(2, "0"); }
function clock(h: number, m: number) { return `${pad(((h % 24) + 24) % 24)}:${pad(m)}`; }

function takeTime(raw: string, hinted?: string | null) {
  let text = raw; let start: string | null = null; let end: string | null = null;
  const period = hinted || (text.match(/早上|上午|今早/) ? "am" : text.match(/中午/) ? "noon" : text.match(/下午|傍晚/) ? "pm" : text.match(/晚上|今晚/) ? "night" : null);
  const span = text.match(/(\d{1,2})\s*(?:[:：点]\s*(\d{1,2}|半)?)\s*(?:到|至|-|—)\s*(\d{1,2})\s*(?:[:：点]\s*(\d{1,2}|半)?)?/);
  const one = text.match(/(\d{1,2})[:：](\d{2})/) || text.match(/(\d{1,2})\s*点\s*(半|(\d{1,2})\s*分?)?/);
  const toMinutes = (token?: string) => (token === "半" ? 30 : token ? Number(String(token).replace("分", "")) || 0 : 0);
  const applyPeriod = (h: number) => {
    if (period === "noon") return 12;
    if (period === "pm" || period === "night") return h < 12 ? h + 12 : h;
    if (period === "am") return h === 12 ? 0 : h;
    if (h >= 1 && h <= 6) return h + 12;
    return h;
  };
  if (span) { start = clock(applyPeriod(Number(span[1])), toMinutes(span[2])); end = clock(applyPeriod(Number(span[3])), toMinutes(span[4])); text = text.replace(span[0], " "); }
  else if (one) { start = clock(applyPeriod(Number(one[1])), toMinutes(one[2])); text = text.replace(one[0], " "); }
  else if (period === "noon") start = "12:00";
  text = text.replace(/早上|上午|今早|中午|下午|傍晚|晚上|今晚/g, " ");
  return { text, start, end };
}
function takeDate(raw: string, today: string) {
  let text = raw; let date = today; let dated = false;
  if (/后天/.test(text)) { date = addDays(today, 2); dated = true; text = text.replace(/后天/, " "); }
  else if (/明天|明早|明晚/.test(text)) { date = addDays(today, 1); dated = true; text = text.replace(/明天|明早|明晚/, " "); }
  else if (/今天|今晚|今早/.test(text)) { dated = true; text = text.replace(/今天|今晚|今早/, " "); }
  const md = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (md) {
    const year = Number(today.slice(0, 4));
    date = `${year}-${pad(Number(md[1]))}-${pad(Number(md[2]))}`;
    if (date < today) date = `${year + 1}-${pad(Number(md[1]))}-${pad(Number(md[2]))}`;
    dated = true; text = text.replace(md[0], " ");
  }
  const dayOnly = text.match(/(\d{1,2})[日号]/);
  if (dayOnly && !md) {
    const month = Number(today.slice(5, 7)); const year = Number(today.slice(0, 4));
    date = `${year}-${pad(month)}-${pad(Number(dayOnly[1]))}`;
    if (date < today) { const n = month === 12 ? 1 : month + 1; const y = month === 12 ? year + 1 : year; date = `${y}-${pad(n)}-${pad(Number(dayOnly[1]))}`; }
    dated = true; text = text.replace(dayOnly[0], " ");
  }
  const wd = text.match(/(下(?:个)?(?:周|星期|礼拜))([日天一二三四五六])|(?:周|星期|礼拜)([日天一二三四五六])/);
  if (wd) { date = dateOnWeekday(today, WEEKDAY[(wd[2] || wd[3]) as string], Boolean(wd[1])); dated = true; text = text.replace(wd[0], " "); }
  return { text, date, dated };
}
function takeRepeat(raw: string): { text: string; repeat: Repeat } {
  if (/每天|每日|天天/.test(raw)) return { text: raw.replace(/每天|每日|天天/g, " "), repeat: "daily" };
  if (/每周|每星期|每礼拜/.test(raw)) return { text: raw.replace(/每周|每星期|每礼拜/g, " "), repeat: "weekly" };
  return { text: raw, repeat: "none" };
}
function guessTag(title: string): Tag {
  if (/体检|睡眠|跑步|散步|运动|医院|吃药/.test(title)) return "health";
  if (/会|报销|交|报告|工|客户|面试/.test(title)) return "work";
  return "life";
}
function cleanTitle(text: string) {
  return text.replace(/提醒我|记得|待办|帮我|把|将|一下/g, " ").replace(/的日程|日程/g, " ").replace(/[，。,;；!！?？]/g, " ").replace(/\s+/g, " ").trim();
}
export function parseAgenda(raw: string, today = todayKey()): Draft | null {
  const input = raw.trim(); if (!input) return null;
  const hinted = /明早|今早|早上|上午/.test(input) ? "am" : /中午/.test(input) ? "noon" : /明晚|晚上|今晚/.test(input) ? "night" : /下午|傍晚/.test(input) ? "pm" : null;
  const r1 = takeRepeat(input); const r2 = takeDate(r1.text, today); const r3 = takeTime(r2.text, hinted);
  const title = cleanTitle(r3.text) || "未命名日程"; const hasTime = Boolean(r3.start);
  return { title, note: "", date: r2.dated || hasTime || r1.repeat !== "none" ? r2.date : "", start: r3.start, end: r3.end, allDay: !hasTime, repeat: r1.repeat, tag: guessTag(title), kind: hasTime ? "event" : "task" };
}
export function describeDraft(d: Draft) {
  const time = d.start ? (d.end ? `${d.start}–${d.end}` : d.start) : "全天";
  const rep = d.repeat === "none" ? "" : d.repeat === "daily" ? "每天" : "每周";
  return [time, rep].filter(Boolean).join(" · ");
}
