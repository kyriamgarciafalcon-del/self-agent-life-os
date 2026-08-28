import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, FileText, Lock, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/chip";
import { ConfirmTxn } from "@/components/confirm-txn";
import { PageHead, Panel, Section } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgenda } from "@/lib/store";
import { useFinance } from "@/lib/finance-store";
import { useVault } from "@/lib/vault-store";
import type { PendingTxn } from "@/lib/finance-types";
import { DEMO_NOTICES, parsePayText } from "@/lib/pay-parser";
import { parseRecordText } from "@/lib/record-parse";

export const Route = createFileRoute("/record")({ component: RecordPage });

const CHIPS = ["晚上点了58元外卖", "工资到账12000元", "记下邮箱账号是 me@x.com 密码是 demo-pass", "提醒我提交报销"];

function RecordPage() {
  const enqueuePending = useFinance((s) => s.enqueuePending);
  const pending = useFinance((s) => s.pending);
  const notifyEnabled = useFinance((s) => s.notifyEnabled);
  const addItem = useAgenda((s) => s.addItem);
  const addVault = useVault((s) => s.add);
  const [text, setText] = useState("");
  const [active, setActive] = useState<PendingTxn | null>(null);
  const [clauses, setClauses] = useState<ReturnType<typeof parseRecordText>>([]);

  function parse() {
    const raw = text.trim();
    if (!raw) { toast("先贴一句，或点通知样例"); return; }
    const pay = parsePayText("", raw.includes("支付") || raw.includes("到账") ? raw : "");
    setClauses(parseRecordText(raw));
    if (pay) enqueuePending(pay);
    toast("已整理，请确认后再保存");
  }

  function saveClauses() {
    let n = 0;
    for (const c of clauses) {
      if (c.kind === "spend") {
        enqueuePending({ id: crypto.randomUUID(), amount: c.amount, dir: "out", title: c.title, source: "other", accountHint: "支付宝", category: c.cat, raw: text, at: Date.now() }); n        n += 1;
      } else if (c.kind === "income") {
        enqueuePending({ id: crypto.randomUUID(), amount: c.amount, dir: "in", title: c.title, source: "other", accountHint: "招商银行卡", category: "收入", raw: text, at: Date.now() });
        n += 1;
      } else if (c.kind === "vault") {
        addVault({ title: c.title, username: c.user, password: c.pass, note: "本机保存 · 未进对话", source: "manual" });
        n += 1;
      } else if (c.kind === "todo") {
        addItem({ title: c.title, note: "来自记录", date: "", start: null, end: null, allDay: true, repeat: "none", tag: "life", kind: "task" });
        n += 1;
      }
    }
    setClauses([]); setText("");
    toast(n ? `${n}项已进入确认或本机保存` : "没有可保存项");
  }

  function simulate(pkg: string, raw: string) {
    const p = parsePayText(pkg, raw);
    if (!p) { toast("这条不像支付通知"); return; }
    toast(enqueuePending(p) ? "已进入待确认，不会改余额" : "10秒内相同通知已去重");
  }

  return (
    <div>
      <PageHead title="记录" caption="识别之后先确认，再入账" />
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-[23px] bg-secondary text-primary"><FileText className="size-8" /></div>
      <h2 className="text-center text-[22px] font-semibold tracking-tight">记一笔，或收一条支付通知</h2>
      <p className="mx-auto mt-2 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">网页里用样例模拟微信/支付宝通知。装到安卓后由系统通知使用权把原文送进来。</p>
      <div className="mt-5 rounded-[20px] border border-input bg-card p-3 shadow-[var(--shadow-lift)]">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：晚上点了58元外卖，或粘贴一条支付通知原文" className="min-h-24 border-0 bg-transparent shadow-none focus-visible:ring-0" />
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <p className="text-[10px] text-muted-foreground">{notifyEnabled ? "通知通道已开" : "通知通道未开"}</p>
          <Button className="h-11 rounded-xl" onClick={parse}>整理</Button>
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{CHIPS.map((c) => (<Chip key={c} onClick={() => setText(c)}>{c}</Chip>))}</div>
      {clauses.length ? (
        <Panel className="mt-4 py-2">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-semibold">请确认整理结果</h3><span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">{clauses.length}项</span></div>
          {clauses.map((c, i) => (
            <div key={`${c.kind}-${i}`} className="flex items-center justify-between border-b border-border py-3 last:border-0">
              <div>
                <p className="text-[13px] font-semibold">{c.kind === "vault" ? `${c.title} 账号` : c.title}</p>
                <p className="text-[10px] text-muted-foreground">{c.kind === "vault" ? "密码库 · 仅本机" : c.kind === "spend" ? "支出 · 确认后入账" : c.kind === "income" ? "收入 · 确认后入账" : "待办"}</p>
              </div>
              <button type="button" className="min-h-11 px-2 text-[11px] font-semibold text-primary" onClick={() => setClauses((list) => list.filter((_, idx) => idx !== i))}>去掉</button>
            </div>
          ))}
          <Button className="mt-3 h-11 w-full rounded-xl" onClick={saveClauses}>确认并保存</Button>
        </Panel>
      ) : null}
      <Section title="模拟支付通知" hint="网页无法监听微信，这里用原文走同一套解析">
        <div className="space-y-2">
          {DEMO_NOTICES.map((n) => (
            <button key={n.raw} type="button" className="flex w-full items-start gap-3 rounded-[16px] border border-border bg-card p-3 text-left" onClick={() => simulate(n.pkg, n.raw)}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Bell className="size-4" /></span>
              <span>
                <strong className="block text-[13px]">{n.pkg.includes("Alipay") ? "支付宝" : n.pkg.includes("tencent") ? "微信" : "云闪付"}</strong>
                <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{n.raw}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="待确认入账" hint={pending.length ? `${pending.length}笔 · 未改余额` : "没有排队的识别"} action={<Link to="/finance" className="min-h-11 text-xs font-semibold text-primary">财务</Link>}>
        {pending.length ? (
          <Panel className="py-1">
            {pending.map((p) => (
              <button key={p.id} type="button" className="flex w-full items-center justify-between border-b border-border py-3 text-left last:border-0" onClick={() => setActive(p)}>
                <span><strong className="block text-[13px]">{p.title}</strong><span className="text-[10px] text-muted-foreground">{p.source} · {p.amount == null ? "金额待补" : `¥${p.amount}`}</span></span>
                <span className="text-[11px] font-semibold text-primary">确认</span>
              </button>
            ))}
          </Panel>
        ) : (<p className="text-xs text-muted-foreground">点上面的通知样例，会生成一条待确认流水。</p>)}
      </Section>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Link to="/finance" className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-[12px] font-semibold"><Wallet className="size-4 text-primary" /> 去财务入账</Link>
        <Link to="/vault" className="flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-[12px] font-semibold"><Lock className="size-4 text-primary" /> 密码库</Link>
      </div>
      <ConfirmTxn pending={active} onClose={() => setActive(null)} />
    </div>
  );
}
