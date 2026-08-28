import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultCashId } from "./finance";
import type { AccountType, LedgerTxn, MoneyAccount, PendingTxn, UpcomingBill } from "./finance-types";
import { isDuplicate as sameNotice } from "./pay-parser";
import { uid } from "./utils";

function seedAccounts(): MoneyAccount[] {
  return [
    { id: "a1", type: "cash", name: "招商银行卡", balance: 12000, note: "工资卡" },
    { id: "a2", type: "cash", name: "支付宝", balance: 4600, note: "日常支付" },
    { id: "a3", type: "cash", name: "现金", balance: 2000, note: "钱包" },
    { id: "a4", type: "invest", name: "货币基金", balance: 26800, note: "参考估值" },
    { id: "a5", type: "credit", name: "花呗", balance: 1280, note: "明天还款" },
    { id: "a6", type: "credit", name: "信用卡", balance: 1920, note: "下月账单" },
    { id: "a7", type: "prepaid", name: "地铁储值", balance: 687, note: "交通卡" },
    { id: "a8", type: "subscribe", name: "视频会员", balance: 25, note: "3天后扣款" },
    { id: "a9", type: "receivable", name: "860元报销", balance: 860, note: "材料待交" },
    { id: "a10", type: "receivable", name: "朋友借款", balance: 1600, note: "对方待还" },
    { id: "a11", type: "payable", name: "欠同事午饭", balance: 80, note: "个人欠款" },
    { id: "a12", type: "asset", name: "闲置显示器", balance: 1500, note: "二手估值" },
  ];
}

function seedTxns(): LedgerTxn[] {
  const at = new Date().toISOString();
  return [
    { id: "s1", at, title: "早餐豆浆油条", amount: 12, cat: "餐饮", accountId: "a2", dir: "out", source: "manual" },
    { id: "s2", at, title: "地铁充值", amount: 50, cat: "交通", accountId: "a2", dir: "out", source: "manual" },
  ];
}

function seedBills(): UpcomingBill[] {
  return [
    { id: "b1", title: "花呗自动还款", sub: "信贷账户 · 尚未入账", amount: 1280, when: "明天", accountId: "a5" },
    { id: "b2", title: "视频会员续费", sub: "订阅账户 · 计划扣款", amount: 25, when: "3天后", accountId: "a8" },
  ];
}

type FinanceState = {
  accounts: MoneyAccount[];
  txns: LedgerTxn[];
  bills: UpcomingBill[];
  pending: PendingTxn[];
  monthBaseIncome: number;
  moneyHidden: boolean;
  notifyEnabled: boolean;
  addAccount: (draft: Omit<MoneyAccount, "id">) => void;
  updateAccount: (id: string, patch: Partial<MoneyAccount>) => void;
  applyBalance: (id: string, delta: number) => void;
  confirmTxn: (input: {
    title: string; amount: number; cat: string; accountId: string; dir: "in" | "out";
    source?: LedgerTxn["source"]; raw?: string; pendingId?: string;
  }) => void;
  enqueuePending: (p: PendingTxn) => boolean;
  dropPending: (id: string) => void;
  payBill: (id: string) => void;
  repay: (id: string, amount: number) => void;
  collect: (id: string, amount: number) => void;
  toggleHidden: () => void;
  setNotifyEnabled: (on: boolean) => void;
};

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      accounts: seedAccounts(),
      txns: seedTxns(),
      bills: seedBills(),
      pending: [],
      monthBaseIncome: 12000,
      moneyHidden: false,
      notifyEnabled: false,
      addAccount: (draft) => set((s) => ({ accounts: [{ ...draft, id: uid() }, ...s.accounts] })),
      updateAccount: (id, patch) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      applyBalance: (id, delta) => set((s) => ({
        accounts: s.accounts.map((a) => a.id === id ? { ...a, balance: Math.max(0, Number(a.balance) + delta) } : a),
      })),
      enqueuePending: (p) => {
        if (get().pending.some((x) => sameNotice(x, p))) return false;
        set((s) => ({ pending: [p, ...s.pending] }));
        return true;
      },
      dropPending: (id) => set((s) => ({ pending: s.pending.filter((p) => p.id !== id) })),
      confirmTxn: (input) => {
        const row: LedgerTxn = {
          id: uid(), at: new Date().toISOString(), title: input.title, amount: input.amount,
          cat: input.cat, accountId: input.accountId, dir: input.dir, source: input.source ?? "manual", raw: input.raw,
        };
        const delta = input.dir === "in" ? input.amount : -input.amount;
        set((s) => ({
          txns: [row, ...s.txns],
          pending: input.pendingId ? s.pending.filter((p) => p.id !== input.pendingId) : s.pending,
          accounts: s.accounts.map((a) => a.id === input.accountId ? { ...a, balance: Math.max(0, a.balance + delta) } : a),
        }));
      },
      payBill: (id) => {
        const bill = get().bills.find((b) => b.id === id);
        if (!bill) return;
        const cashId = defaultCashId(get().accounts);
        get().confirmTxn({ title: bill.title, amount: bill.amount, cat: "账单", accountId: cashId, dir: "out" });
        if (bill.accountId) get().applyBalance(bill.accountId, -bill.amount);
        set((s) => ({ bills: s.bills.filter((b) => b.id !== id) }));
      },
      repay: (id, amount) => {
        const acc = get().accounts.find((a) => a.id === id);
        if (!acc) return;
        const pay = Math.min(amount, acc.balance);
        const cashId = defaultCashId(get().accounts);
        get().applyBalance(id, -pay);
        get().confirmTxn({ title: `偿还 ${acc.name}`, amount: pay, cat: "还款", accountId: cashId, dir: "out" });
      },
      collect: (id, amount) => {
        const acc = get().accounts.find((a) => a.id === id);
        if (!acc) return;
        const got = Math.min(amount, acc.balance);
        const cashId = defaultCashId(get().accounts);
        get().applyBalance(id, -got);
        get().confirmTxn({ title: `收回 ${acc.name}`, amount: got, cat: "收回", accountId: cashId, dir: "in" });
      },
      toggleHidden: () => set((s) => ({ moneyHidden: !s.moneyHidden })),
      setNotifyEnabled: (on) => set({ notifyEnabled: on }),
    }),
    { name: "self-agent-finance-v1", skipHydration: true },
  ),
);

export function hintAccountId(accounts: MoneyAccount[], hint: string, type: AccountType = "cash") {
  const pool = accounts.filter((a) => a.type === type);
  const hit = pool.find((a) => hint.includes(a.name) || a.name.includes(hint.replace(/零钱\/银行卡/g, "")));
  return hit?.id || defaultCashId(accounts);
}
