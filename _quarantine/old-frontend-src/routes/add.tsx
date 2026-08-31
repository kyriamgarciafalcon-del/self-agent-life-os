import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EventForm } from "@/components/event-form";
import { PageHead } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { describeDraft, parseAgenda } from "@/lib/parse";
import { formatWhen, todayKey } from "@/lib/agenda";
import { useAgenda } from "@/lib/store";
import type { Draft } from "@/lib/types";

export const Route = createFileRoute("/add")({
  validateSearch: (raw: Record<string, unknown>) => ({ date: typeof raw.date === "string" ? raw.date : undefined }),
  component: AddPage,
});
const CHIPS = ["明天下午3点开会", "周五上午9点半体检", "每天早上7点散步", "今晚8点给家里打电话", "买牙膏"];
function emptyDraft(date?: string): Draft {
  return { title: "", note: "", date: date ?? todayKey(), start: null, end: null, allDay: true, repeat: "none", tag: "life", kind: "task" };
}
function AddPage() {
  const { date } = Route.useSearch();
  const addItem = useAgenda((s) => s.addItem);
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Draft | null>(null);
  const [manual, setManual] = useState(false);
  const initial = useMemo(() => emptyDraft(date), [date]);
  function parse() {
    const raw = text.trim();
    if (!raw) { toast("先说一句，或点上方例句"); return; }
    const draft = parseAgenda(raw);
    if (!draft) { toast("没听懂，改用手填"); setManual(true); return; }
    if (date && !draft.date) draft.date = date;
    setPending(draft); toast("已整理，请确认后再保存");
  }
  function save(draft: Draft) { addItem(draft); toast("已写入日程"); void navigate({ to: "/" }); }
  return (
    <div>
      <PageHead title="添加" caption="一句话说完，或手填" back />
      {!manual && !pending ? (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{CHIPS.map((c) => <button key={c} type="button" className="min-h-11 shrink-0 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-ink" onClick={() => setText(c)}>{c}</button>)}</div>
          <div className="rounded-[20px] border border-input bg-card p-3 shadow-[var(--shadow-lift)]">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：明天下午3点开会，周五上午体检" className="min-h-24 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <button type="button" className="min-h-11 px-2 text-[11px] font-semibold text-primary" onClick={() => setManual(true)}>改用手填</button>
              <Button className="h-11 rounded-xl px-4 text-xs" onClick={parse}>整理成日程</Button>
            </div>
          </div>
        </>
      ) : null}
      {pending ? (
        <div className="mt-2">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">已整理为「{pending.title}」· {pending.date ? formatWhen(pending.date) : "未定日期"} · {describeDraft(pending)}。数字不对就改，确认后再保存。</p>
          <EventForm key={pending.title + pending.date + pending.start} initial={pending} submitLabel="确认并保存" onSubmit={save} />
          <button type="button" className="mt-2 w-full text-center text-[11px] text-muted-foreground" onClick={() => setPending(null)}>返回重说</button>
        </div>
      ) : null}
      {manual && !pending ? (
        <div className="mt-1">
          <EventForm initial={initial} submitLabel="保存日程" onSubmit={save} />
          <button type="button" className="mt-2 w-full text-center text-[11px] text-muted-foreground" onClick={() => setManual(false)}>改用一句话添加</button>
        </div>
      ) : null}
    </div>
  );
}
