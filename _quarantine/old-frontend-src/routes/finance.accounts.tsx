import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/chip";
import { IconBtn, PageHead, Panel, Section } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCOUNT_TYPE_ORDER, ACCOUNT_TYPES, yuan } from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import type { AccountType, MoneyAccount } from "@/lib/finance-types";

export const Route = createFileRoute("/finance/accounts")({
  validateSearch: (raw: Record<string, unknown>) => ({
    type: typeof raw.type === "string" && raw.type in ACCOUNT_TYPES ? (raw.type as AccountType) : ("all" as const),
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const { type } = Route.useSearch();
  const accounts = useFinance((s) => s.accounts);
  const hidden = useFinance((s) => s.moneyHidden);
  const repay = useFinance((s) => s.repay);
  const collect = useFinance((s) => s.collect);
  const [filter, setFilter] = useState<AccountType | "all">(type === "all" ? "all" : type);
  const [editing, setEditing] = useState<Partial<MoneyAccount> | null>(null);
  const rows = accounts.filter((a) => filter === "all" || a.type === filter);
  return (
    <div>
      <PageHead title="账户" caption={`${accounts.length}个账户 · 分类记账`} back right={
        <IconBtn icon={Plus} label="新增账户" onClick={() => setEditing({ type: filter === "all" ? "cash" : filter, name: "", balance: 0, note: "本机新增" })} />
      } />
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>全部</Chip>
        {ACCOUNT_TYPE_ORDER.map((t) => <Chip key={t} active={filter === t} onClick={() => setFilter(t)}>{ACCOUNT_TYPES[t].label}</Chip>)}
      </div>
      <Section title={filter === "all" ? "账户明细" : `${ACCOUNT_TYPES[filter].label}明细`} hint={`${rows.length}个`}>
        <Panel className="py-1">
          {rows.map((a) => {
            const meta = ACCOUNT_TYPES[a.type];
            const debt = meta.side === "debt" || meta.side === "plan";
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 border-b border-border py-3 last:border-0">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(a)}>
                  <p className="text-[13px] font-semibold">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{meta.label} · {a.note}</p>
                </button>
                <div className="text-right">
                  <p className="text-[13px] font-semibold">{hidden ? "••••" : yuan(debt ? -a.balance : a.balance, debt)}</p>
                  {a.type === "receivable" ? <button type="button" className="min-h-11 text-[11px] font-semibold text-primary" onClick={() => { collect(a.id, a.balance); toast("已收回，进入资金账户"); }}>收回</button> : null}
                  {meta.side === "debt" ? <button type="button" className="min-h-11 text-[11px] font-semibold text-primary" onClick={() => { repay(a.id, a.balance); toast("已还款"); }}>还清</button> : null}
                </div>
              </div>
            );
          })}
        </Panel>
      </Section>
      <AccountSheet value={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function AccountSheet({ value, onClose }: { value: Partial<MoneyAccount> | null; onClose: () => void }) {
  const addAccount = useFinance((s) => s.addAccount);
  const updateAccount = useFinance((s) => s.updateAccount);
  const [name, setName] = useState(value?.name ?? "");
  const [balance, setBalance] = useState(String(value?.balance ?? ""));
  const [type, setType] = useState<AccountType>(value?.type ?? "cash");
  return (
    <Dialog open={Boolean(value)} onOpenChange={(v) => {
      if (!v) onClose();
      else { setName(value?.name ?? ""); setBalance(value?.balance != null ? String(value.balance) : ""); setType(value?.type ?? "cash"); }
    }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{value?.id ? `调整 ${value.name}` : "添加账户"}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast("先写账户名"); return; }
          if (value?.id) updateAccount(value.id, { name: name.trim(), balance: Number(balance || 0), type });
          else addAccount({ name: name.trim(), balance: Number(balance || 0), type, note: "本机新增" });
          toast("账户已保存"); onClose();
        }}>
          <div className="flex flex-wrap gap-2">{ACCOUNT_TYPE_ORDER.map((t) => <Chip key={t} active={t === type} onClick={() => setType(t)}>{ACCOUNT_TYPES[t].label}</Chip>)}</div>
          <div className="space-y-1.5"><Label htmlFor="acc-name">名称</Label><Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="acc-bal">余额 / 待还</Label><Input id="acc-bal" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>
          <Button type="submit" className="h-11 w-full rounded-xl">保存</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
