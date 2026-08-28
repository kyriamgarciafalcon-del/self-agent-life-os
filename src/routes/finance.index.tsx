import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmTxn } from "@/components/confirm-txn";
import { Chip } from "@/components/chip";
import { IconBtn, PageHead, Panel, Section } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCOUNT_TYPES, accountsOf, financeSnap, sumType, whenLabel, yuan } from "@/lib/finance";
import { hintAccountId, useFinance } from "@/lib/finance-store";
import type { AccountType, PendingTxn } from "@/lib/finance-types";

export const Route = createFileRoute("/finance/")({ component: FinancePage });

function money(hidden: boolean, n: number, signed = false) {
  return hidden ? "••••" : yuan(n, signed);
}

function FinancePage() {
  const accounts = useFinance((s) => s.accounts);
  const txns = useFinance((s) => s.txns);
  const bills = useFinance((s) => s.bills);
  const pending = useFinance((s) => s.pending);
  const hidden = useFinance((s) => s.moneyHidden);
  const monthBaseIncome = useFinance((s) => s.monthBaseIncome);
  const toggleHidden = useFinance((s) => s.toggleHidden);
  const payBill = useFinance((s) => s.payBill);
  const snap = useMemo(() => financeSnap(accounts, txns, bills, monthBaseIncome), [accounts, txns, bills, monthBaseIncome]);
  const [active, setActive] = useState<PendingTxn | null>(null);
  const [sheet, setSheet] = useState<"in" | "out" | null>(null);
  const typePreview: AccountType[] = ["cash", "credit", "invest", "receivable"];

  return (
    <div>
      <PageHead title="财务" caption={`本月 · ${txns.filter((t) => t.dir === "out").length}笔支出 · ${accounts.length}个账户`} right={
        <IconBtn icon={hidden ? EyeOff : Eye} label={hidden ? "显示金额" : "隐藏金额"} onClick={() => { toggleHidden(); toast(hidden ? "金额已显示" : "金额已隐藏"); }} />
      } />
      <article className="rounded-[18px] bg-brand-deep p-4 text-primary-foreground">
        <h2 className="text-[13px] font-medium text-primary-foreground/70">可自由使用</h2>
        <p className="mt-2 font-mono text-[31px] font-semibold tracking-tight">{money(hidden, snap.free)}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <div><strong className="block text-[15px]">{money(hidden, snap.liquid)}</strong><span className="text-primary-foreground/65">资金</span></div>
          <div><strong className="block text-[15px]">{money(hidden, snap.credit)}</strong><span className="text-primary-foreground/65">待还信贷</span></div>
          <div><strong className="block text-[15px]">{money(hidden, snap.receivable)}</strong><span className="text-primary-foreground/65">待收回</span></div>
        </div>
      </article>
      {pending.length ? (
        <button type="button" className="mt-3 w-full rounded-2xl border border-primary/20 bg-secondary px-4 py-3 text-left" onClick={() => setActive(pending[0])}>
          <p className="text-[11px] font-semibold text-brand-deep">{pending.length} 笔支付识别待确认</p>
          <p className="mt-1 text-[12px] text-ink">未点确认前，账户余额不会动。</p>
        </button>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button className="h-11 rounded-xl" onClick={() => setSheet("out")}>记一笔支出</Button>
        <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setSheet("in")}>记一笔收入</Button>
      </div>
      <Section title="账户分类" hint="账户只在财务里" action={<Link to="/finance/accounts" search={{ type: "all" }} className="min-h-11 text-xs font-semibold text-primary">全部</Link>}>
        <div className="grid grid-cols-2 gap-2">
          {typePreview.map((type) => {
            const meta = ACCOUNT_TYPES[type];
            const total = sumType(accounts, type);
            const signed = meta.side === "debt";
            return (
              <Link key={type} to="/finance/accounts" search={{ type }} className="rounded-[15px] border border-border bg-card p-3 text-left">
                <div className="flex items-center justify-between text-[13px] font-semibold"><span>{meta.label}</span><b>{money(hidden, signed ? -total : total, signed)}</b></div>
                <p className="mt-2 text-[10px] text-muted-foreground">{accountsOf(accounts, type).length}个账户 · {meta.hint}</p>
              </Link>
            );
          })}
        </div>
      </Section>
      <Section title="最近流水">
        <Panel className="py-1">
          {txns.slice(0, 12).map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-2 border-b border-border py-3 last:border-0">
              <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{x.title}</p><p className="text-[10px] text-muted-foreground">{whenLabel(x.at)} · {x.cat}</p></div>
              <p className="shrink-0 text-[13px] font-semibold">{money(hidden, x.dir === "in" ? x.amount : -x.amount, true)}</p>
            </div>
          ))}
        </Panel>
      </Section>
      <MoneySheet open={sheet} onClose={() => setSheet(null)} />
      <ConfirmTxn pending={active} onClose={() => setActive(null)} />
    </div>
  );
}

function MoneySheet({ open, onClose }: { open: "in" | "out" | null; onClose: () => void }) {
  const accounts = useFinance((s) => s.accounts);
  const confirmTxn = useFinance((s) => s.confirmTxn);
  const cash = accountsOf(accounts, "cash");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("餐饮");
  const [accountId, setAccountId] = useState("");
  const cats = open === "in" ? ["收入", "工资", "报销", "其他"] : ["餐饮", "交通", "购物", "订阅", "其他"];
  return (
    <Dialog open={Boolean(open)} onOpenChange={(v) => {
      if (!v) onClose();
      else { setTitle(""); setAmount(""); setCat(open === "in" ? "收入" : "餐饮"); setAccountId(hintAccountId(accounts, "支付宝")); }
    }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{open === "in" ? "记入资金账户" : "从资金账户支出"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (!n || n <= 0) { toast("先填金额"); return; }
          confirmTxn({ title: title.trim() || cat, amount: n, cat, accountId, dir: open === "in" ? "in" : "out", source: "manual" });
          toast("已记入对应账户"); onClose();
        }}>
          <Input placeholder="名称" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input inputMode="decimal" placeholder="金额" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex flex-wrap gap-2">{cats.map((c) => <Chip key={c} active={c === cat} onClick={() => setCat(c)}>{c}</Chip>)}</div>
          <div className="flex flex-wrap gap-2">{cash.map((a) => <Chip key={a.id} active={a.id === accountId} onClick={() => setAccountId(a.id)}>{a.name}</Chip>)}</div>
          <Button type="submit" className="h-11 w-full rounded-xl">保存</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
