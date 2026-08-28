import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { EventRow } from "@/components/event-row";
import { Panel } from "@/components/bits";
import { formatMonthTitle, formatWhen, itemsOn, monthGrid, todayKey } from "@/lib/agenda";
import { useAgenda } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });
const HEAD = ["一", "二", "三", "四", "五", "六", "日"];

function CalendarPage() {
  const today = todayKey();
  const items = useAgenda((s) => s.items);
  const toggleDone = useAgenda((s) => s.toggleDone);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [selected, setSelected] = useState(today);
  const cells = useMemo(() => monthGrid(year, month0), [year, month0]);
  const dayItems = itemsOn(items, selected);
  function shift(delta: number) {
    const d = new Date(year, month0 + delta, 1);
    setYear(d.getFullYear()); setMonth0(d.getMonth());
  }
  return (
    <div>
      <header className="mb-3 flex items-center justify-between py-2">
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card" aria-label="上一月" onClick={() => shift(-1)}><ChevronLeft className="size-5" /></button>
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">{formatMonthTitle(year, month0)}</h1>
          <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => { const n = new Date(); setYear(n.getFullYear()); setMonth0(n.getMonth()); setSelected(today); }}>回到今天</button>
        </div>
        <button type="button" className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card" aria-label="下一月" onClick={() => shift(1)}><ChevronRight className="size-5" /></button>
      </header>
      <Panel className="p-3">
        <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-muted-foreground">{HEAD.map((d) => <span key={d} className="py-1">{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((cell) => {
            const count = itemsOn(items, cell.key).length;
            const isToday = cell.key === today; const isSel = cell.key === selected;
            return (
              <button key={cell.key} type="button" onClick={() => setSelected(cell.key)} className={cn("mx-auto flex size-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold", !cell.inMonth && "text-muted-foreground/40", isSel && "bg-primary text-primary-foreground", !isSel && isToday && "bg-secondary text-brand-deep")}>
                {Number(cell.key.slice(8))}
                <span className="mt-0.5 flex h-1 justify-center gap-0.5">{count ? <i className={cn("block size-1 rounded-full", isSel ? "bg-primary-foreground" : "bg-primary")} /> : <i className="block size-1" />}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      <div className="mt-5 flex items-end justify-between px-0.5">
        <div><h2 className="text-[17px] font-semibold">{formatWhen(selected, today)}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{dayItems.length ? `${dayItems.length} 项安排` : "这一天还空着"}</p></div>
        <Link to="/add" search={{ date: selected }} className="min-h-11 text-xs font-semibold text-primary">添加到这天</Link>
      </div>
      {dayItems.length ? (
        <Panel className="mt-3 py-1">{dayItems.map((it) => <EventRow key={it.id} item={it} onDate={selected} onToggle={() => { toggleDone(it.id, selected); toast("已更新"); }} />)}</Panel>
      ) : (
        <Panel className="mt-3 py-8 text-center text-sm text-muted-foreground">点右上角，把事情放进这一天</Panel>
      )}
    </div>
  );
}
