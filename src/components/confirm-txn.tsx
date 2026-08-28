import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/chip";
import { accountsOf } from "@/lib/finance";
import type { PendingTxn } from "@/lib/finance-types";
import { hintAccountId, useFinance } from "@/lib/finance-store";

const OUT_CATS = ["餐饮", "交通", "购物", "订阅", "其他"];
const IN_CATS = ["收入", "工资", "报销", "其他"];

export function ConfirmTxn({ pending, onClose }: { pending: PendingTxn | null; onClose: () => void }) {
  const accounts = useFinance((s) => s.accounts);
  const confirmTxn = useFinance((s) => s.confirmTxn);
  const dropPending = useFinance((s) => s.dropPending);
  const cash = accountsOf(accounts, "cash");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("其他");
  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!pending) return;
    setAmount(pending.amount ? String(pending.amount) : "");
    setCat(pending.category);
    setAccountId(hintAccountId(accounts, pending.accountHint));
    setTitle(pending.title);
  }, [pending, accounts]);

  const open = Boolean(pending);
  const cats = pending?.dir === "in" ? IN_CATS : OUT_CATS;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pending?.dir === "in" ? "确认收入" : "确认支出"}</DialogTitle>
        </DialogHeader>
        {pending ? (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount);
            if (!n || n <= 0) { toast("先补上金额，微信通知常常没有数字"); return; }
            if (!accountId) { toast("先选一个资金账户"); return; }
            confirmTxn({ title: title.trim() || pending.title, amount: n, cat, accountId, dir: pending.dir, source: "notify", raw: pending.raw, pendingId: pending.id });
            toast("已入账。未确认的识别不会改余额");
            onClose();
          }}>
            <p className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-relaxed text-ink">原文：{pending.raw}</p>
            <div className="space-y-1.5"><Label htmlFor="txn-title">名称</Label><Input id="txn-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="txn-amount">金额（元）</Label>
              <Input id="txn-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={pending.amount == null ? "通知里没有金额，请手填" : ""} />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">分类</p>
              <div className="flex flex-wrap gap-2">{cats.map((c) => (<Chip key={c} active={c === cat} onClick={() => setCat(c)}>{c}</Chip>))}</div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">入账账户</p>
              <div className="flex flex-wrap gap-2">{cash.map((a) => (<Chip key={a.id} active={a.id === accountId} onClick={() => setAccountId(a.id)}>{a.name}</Chip>))}</div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="h-11 flex-1 rounded-xl">确认入账</Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => { dropPending(pending.id); toast("已忽略"); onClose(); }}>忽略</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
