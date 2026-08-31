import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EventRow } from "@/components/event-row";
import { PageHead, Panel } from "@/components/bits";
import { formatWhen, isDone, todayKey } from "@/lib/agenda";
import { useAgenda } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  const items = useAgenda((s) => s.items);
  const toggleDone = useAgenda((s) => s.toggleDone);
  const reset = useAgenda((s) => s.reset);
  const [tab, setTab] = useState<"open" | "done">("open");
  const today = todayKey();
  const tasks = items.filter((it) => it.kind === "task");
  const visible = tasks.filter((it) => (tab === "done" ? isDone(it) : !isDone(it)));
  const inbox = visible.filter((it) => !it.date);
  const dated = visible.filter((it) => it.date);
  return (
    <div>
      <PageHead title="待办" caption="没有钟点的事" />
      <div className="grid grid-cols-2 gap-1 rounded-[13px] bg-muted p-1">
        {(["open", "done"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("min-h-11 rounded-[10px] text-[11px] font-semibold", tab === k ? "bg-card text-brand-deep shadow-sm" : "text-muted-foreground")}>
            {k === "open" ? "未完成" : "已完成"}
          </button>
        ))}
      </div>
      {inbox.length ? (
        <div className="mt-5"><h2 className="px-0.5 text-[17px] font-semibold">随时可做</h2>
          <Panel className="mt-2 py-1">{inbox.map((it) => <EventRow key={it.id} item={it} onToggle={() => { toggleDone(it.id); toast(tab === "open" ? "完成" : "已恢复"); }} />)}</Panel>
        </div>
      ) : null}
      {dated.length ? (
        <div className="mt-5"><h2 className="px-0.5 text-[17px] font-semibold">有截止日期</h2>
          <Panel className="mt-2 py-1">{dated.slice().sort((a, b) => a.date.localeCompare(b.date)).map((it) => (
            <div key={it.id}><p className="pt-2 text-[10px] font-semibold text-muted-foreground">{formatWhen(it.date, today)}{it.date && it.date < today && tab === "open" ? " · 过期" : ""}</p>
              <EventRow item={it} onToggle={() => { toggleDone(it.id); toast("已更新"); }} /></div>
          ))}</Panel>
        </div>
      ) : null}
      {!visible.length ? (
        <Panel className="mt-5 py-10 text-center">
          <p className="text-sm font-semibold">{tab === "open" ? "没有未完成的待办" : "还没有完成记录"}</p>
          <Link to="/add" search={{ date: undefined }} className="mt-3 inline-flex min-h-11 text-xs font-semibold text-primary">添加待办</Link>
        </Panel>
      ) : null}
      <button type="button" className="mt-6 w-full text-center text-[11px] text-muted-foreground" onClick={() => { reset(); toast("已恢复示例日程"); }}>恢复示例日程</button>
    </div>
  );
}
