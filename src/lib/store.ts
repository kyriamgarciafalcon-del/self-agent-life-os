import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, dateOnWeekday, doneKey, todayKey } from "./agenda";
import type { AgendaItem, Draft } from "./types";
import { uid } from "./utils";

function seed(): AgendaItem[] {
  const t = todayKey();
  const sun = dateOnWeekday(t, 0);
  return [
    { id: "e1", title: "提交860元报销", note: "预计15分钟，本周内截止", date: t, start: "09:30", end: "09:45", allDay: false, repeat: "none", tag: "work", kind: "event", completedOn: [] },
    { id: "e2", title: "晚饭后散步", note: "小区绕两圈即可", date: t, start: "18:30", end: "19:00", allDay: false, repeat: "daily", tag: "health", kind: "event", completedOn: [] },
    { id: "e3", title: "睡前放下手机", note: "23:30 开始准备睡", date: t, start: "23:30", end: null, allDay: false, repeat: "daily", tag: "health", kind: "event", completedOn: [] },
    { id: "e4", title: "年度体检", note: "市体检中心 · 上午", date: addDays(t, 5), start: "09:30", end: "11:30", allDay: false, repeat: "none", tag: "health", kind: "event", completedOn: [] },
    { id: "e5", title: "一周复盘", note: "写下下周三件要事", date: sun, start: "20:00", end: "20:30", allDay: false, repeat: "weekly", tag: "work", kind: "event", completedOn: [] },
    { id: "t1", title: "确认视频会员是否续费", note: "3天后自动扣款", date: addDays(t, 3), start: null, end: null, allDay: true, repeat: "none", tag: "life", kind: "task", completedOn: [] },
    { id: "t2", title: "买牙膏和替换牙刷头", note: "", date: "", start: null, end: null, allDay: true, repeat: "none", tag: "life", kind: "task", completedOn: [] },
  ];
}

type AgendaState = {
  items: AgendaItem[];
  addItem: (draft: Draft) => string;
  updateItem: (id: string, patch: Partial<AgendaItem>) => void;
  removeItem: (id: string) => void;
  toggleDone: (id: string, onDate?: string) => void;
  reset: () => void;
};

export const useAgenda = create<AgendaState>()(
  persist(
    (set, get) => ({
      items: seed(),
      addItem: (draft) => {
        const id = uid();
        set((s) => ({ items: [{ ...draft, id, completedOn: [] }, ...s.items] }));
        return id;
      },
      updateItem: (id, patch) => set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
      toggleDone: (id, onDate) => {
        const item = get().items.find((it) => it.id === id);
        if (!item) return;
        const key = doneKey(item, onDate);
        const has = item.completedOn.includes(key);
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, completedOn: has ? it.completedOn.filter((k) => k !== key) : [...it.completedOn, key] } : it,
          ),
        }));
      },
      reset: () => set({ items: seed() }),
    }),
    { name: "qinghe-agenda-v1", skipHydration: true },
  ),
);
