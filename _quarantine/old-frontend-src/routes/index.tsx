import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { EventRow } from "@/components/event-row";
import { Panel, Section } from "@/components/bits";
import { formatClock, formatDateLong, formatWhen, greeting, isDone, itemsOn, overdueItems, todayKey, upcomingDays } from "@/lib/agenda";
import { financeSnap, yuan } from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { useAgenda } from "@/lib/store";

export const Route = createFileRoute("/")({ component: TodayPage });

function TodayPage() {
  const items = useAgenda((s) => s.items);
  const toggleDone = useAgenda((s) => s.toggleDone);
  const accounts = useFinance((s) => s.accounts);
  const txns = useFinance((s) => s.txns);
  const bills = useFinance((s) => s.bills);
  const pending = useFinance((s) => s.pending);
  const hidden = useFinance((s) => s.moneyHidden);
  const monthBaseIncome = useFinance((s) => s.monthBaseIncome);
  const snap = financeSnap(accounts, txns, bills, monthBaseIncome);
  const today = todayKey();
  const todayItems = itemsOn(items, today);
  const open = todayItems.filter((it) => !isDone(it, today));
  const overdue = overdueItems(items, today);
  const next = open.find((it) => it.start) ?? open[0];
  const upcoming = upcomingDays(items, today, 10).slice(0, 4);
  const inbox = items.filter((it) => it.kind === "task" && !it.date && !isDone(it));
  return (
    <div>
      <header className="py-3">
        <p className="text-xs font-semibold text-muted-foreground">{formatDateLong(today)}</p>
        <h1 className="mt-1 text-[23px] font-semibold leading-snug">{greeting()}，今天{open.length ? `还有 ${open.length} 件事` : "的安排都完成了"}</h1>
      </header>
      <article className="relative overflow-hidden rounded-[18px] bg-brand-deep p-4 text-primary-foreground shadow-[var(--shadow-lift)]">
        <span className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full bg-primary-foreground/10" />
        <p className="text-xs font-semibold text-primary-foreground/80">下一件</p>
        {next ? (
          <><h2 className="relative mt-3 max-w-xs text-[21px] font-semibold leading-snug">{next.title}</h2>
          <p className="relative mt-2 text-[13px] text-primary-foreground/85">{next.start ? formatClock(next.start) : "今天完成即可"}{next.note ? ` · ${next.note}` : ""}</p></>
        ) : (
          <><h2 className="relative mt-3 text-[21px] font-semibold">今天可以收工了</h2><p className="relative mt-2 text-[13px] text-primary-foreground/85">没有未完成的安排。明天的事明天再看。</p></>
        )}
        <div className="relative mt-4 flex gap-2">
          {next ? <button type="button" className="inline-flex h-11 items-center rounded-xl bg-card px-4 text-xs font-semibold whitespace-nowrap text-brand-deep" onClick={() => { toggleDone(next.id, today); toast("已完成，很好"); }}>完成这件事</button> : null}
          <Link to="/add" search={{ date: undefined }} className="inline-flex h-11 items-center rounded-xl border border-primary-foreground/35 px-4 text-xs font-semibold whitespace-nowrap text-primary-foreground">添加日程</Link>
        </div>
      </article>
      {pending.length ? (
        <Link to="/record" className="mt-3 block rounded-2xl border border-primary/20 bg-secondary px-4 py-3">
          <p className="text-[11px] font-semibold text-brand-deep">{pending.length} 笔支付待确认</p>
          <p className="mt-1 text-[12px] text-ink">点进去核对金额和账户，确认前余额不动。</p>
        </Link>
      ) : null}
      <Link to="/finance" className="mt-3 block rounded-[18px] border border-border bg-card p-4 text-left">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground"><span>可自由使用</span><span>财务</span></div>
        <p className="mt-2 text-[22px] font-semibold tracking-tight">{hidden ? "••••" : yuan(snap.free)}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">资金 {hidden ? "••••" : yuan(snap.liquid)} · 待还 {hidden ? "••••" : yuan(snap.credit)}</p>
      </Link>
      {overdue.length ? (<Section title="已过期" hint="先清掉误点，或改到新的一天"><Panel className="py-1">{overdue.map((it) => <EventRow key={it.id} item={it} onToggle={() => toggleDone(it.id)} />)}</Panel></Section>) : null}
      <Section title="今天" hint={open.length ? `${open.length}件未完成` : "全部完成"}>
        {todayItems.length ? (
          <Panel className="py-1">{todayItems.map((it) => <EventRow key={it.id} item={it} onDate={today} onToggle={() => { toggleDone(it.id, today); toast(isDone(it, today) ? "已恢复" : "已完成"); }} />)}</Panel>
        ) : <Empty text="今天还没有安排" />}
      </Section>
      {inbox.length ? (<Section title="未定日期" hint="想做、但还没排进某一天"><Panel className="py-1">{inbox.map((it) => <EventRow key={it.id} item={it} onToggle={() => toggleDone(it.id)} />)}</Panel></Section>) : null}
      <Section title="接下来" hint="未来两周" action={<Link to="/calendar" className="min-h-11 text-xs font-semibold text-primary">日历</Link>}>
        {upcoming.length ? (
          <Panel className="py-1">{upcoming.map((row) => (
            <div key={row.key} className="border-b border-border py-3 last:border-0">
              <p className="text-[11px] font-semibold text-muted-foreground">{formatWhen(row.key, today)}</p>
              <ul className="mt-1">{row.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-2 text-[13px]">
                  <Link to="/item/$id" params={{ id: it.id }} className="truncate font-medium">{it.title}</Link>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{it.start ? formatClock(it.start) : "全天"}</span>
                </li>
              ))}</ul>
            </div>
          ))}</Panel>
        ) : <Empty text="后面两周也很清闲" />}
      </Section>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <Panel className="flex flex-col items-center py-8 text-center">
      <p className="text-sm font-semibold">{text}</p>
      <Link to="/add" search={{ date: undefined }} className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary"><Plus className="size-4" /> 添加一条</Link>
    </Panel>
  );
}
