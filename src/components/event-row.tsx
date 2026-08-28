import { Link } from "@tanstack/react-router";
import { formatClock, isDone, tagClass } from "@/lib/agenda";
import type { AgendaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EventRow({ item, onDate, onToggle }: { item: AgendaItem; onDate?: string; onToggle: () => void }) {
  const done = isDone(item, onDate);
  return (
    <article className={cn("grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border py-3 last:border-0", done && "opacity-55")}>
      <p className="text-[11px] font-semibold tabular-nums text-muted-foreground">{item.start ? formatClock(item.start) : item.kind === "task" ? "待办" : "全天"}</p>
      <Link to="/item/$id" params={{ id: item.id }} className="min-w-0">
        <span className="flex items-center gap-2">
          <span className={cn("size-1.5 shrink-0 rounded-full", tagClass(item.tag))} />
          <strong className={cn("block truncate text-[13px]", done && "line-through")}>{item.title}</strong>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.note || (item.repeat === "daily" ? "每天" : item.repeat === "weekly" ? "每周" : "一次")}</span>
      </Link>
      <button type="button" className="min-h-11 min-w-11 rounded-[10px] border border-border bg-muted px-2.5 text-[11px] font-semibold text-brand-deep" onClick={onToggle}>{done ? "撤销" : "完成"}</button>
    </article>
  );
}
