import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPEAT_LABEL, TAG_LABEL } from "@/lib/agenda";
import type { Draft, Repeat, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const TAGS: Tag[] = ["work", "life", "health"];
const REPEATS: Repeat[] = ["none", "daily", "weekly"];

export function EventForm({
  initial, submitLabel, onSubmit, onDelete,
}: { initial: Draft; submitLabel: string; onSubmit: (draft: Draft) => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState<Draft>(initial);
  function patch(p: Partial<Draft>) {
    setDraft((d) => {
      const next = { ...d, ...p };
      if ("start" in p) { next.allDay = !next.start; next.kind = next.start ? "event" : "task"; }
      return next;
    });
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (!draft.title.trim()) return; onSubmit({ ...draft, title: draft.title.trim() }); }}>
      <div><Label htmlFor="title">标题</Label><Input id="title" className="mt-1 h-11 rounded-xl bg-card" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="例如：周五体检" required /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label htmlFor="date">日期</Label><Input id="date" type="date" className="mt-1 h-11 rounded-xl bg-card" value={draft.date} onChange={(e) => patch({ date: e.target.value })} /></div>
        <div><Label htmlFor="start">开始</Label><Input id="start" type="time" className="mt-1 h-11 rounded-xl bg-card" value={draft.start ?? ""} onChange={(e) => patch({ start: e.target.value || null })} /></div>
      </div>
      <div><Label htmlFor="end">结束（可选）</Label><Input id="end" type="time" className="mt-1 h-11 rounded-xl bg-card" value={draft.end ?? ""} onChange={(e) => patch({ end: e.target.value || null })} /></div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">重复</p>
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-[13px] bg-muted p-1">
          {REPEATS.map((r) => <button key={r} type="button" className={cn("min-h-11 rounded-[10px] text-[11px] font-semibold", draft.repeat === r ? "bg-card text-brand-deep shadow-sm" : "text-muted-foreground")} onClick={() => patch({ repeat: r })}>{REPEAT_LABEL[r]}</button>)}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">分类</p>
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-[13px] bg-muted p-1">
          {TAGS.map((t) => <button key={t} type="button" className={cn("min-h-11 rounded-[10px] text-[11px] font-semibold", draft.tag === t ? "bg-card text-brand-deep shadow-sm" : "text-muted-foreground")} onClick={() => patch({ tag: t })}>{TAG_LABEL[t]}</button>)}
        </div>
      </div>
      <div><Label htmlFor="note">备注</Label><Textarea id="note" className="mt-1 min-h-20 rounded-xl bg-card" value={draft.note} onChange={(e) => patch({ note: e.target.value })} placeholder="地点、材料、要带什么" /></div>
      <Button type="submit" className="h-11 rounded-xl">{submitLabel}</Button>
      {onDelete ? <button type="button" className="h-11 text-xs text-destructive" onClick={onDelete}>删除这条日程</button> : null}
    </form>
  );
}
