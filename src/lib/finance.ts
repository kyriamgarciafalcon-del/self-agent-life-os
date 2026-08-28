import type { AccountSide, AccountType, LedgerTxn, MoneyAccount } from "./finance-types";

export const ACCOUNT_TYPES: Record<
  AccountType,
  { label: string; hint: string; side: AccountSide }
> = {
  cash: { label: "资金", hint: "现金、银行卡、支付余额", side: "asset" },
  invest: { label: "理财", hint: "基金、存款，仅参考估值", side: "asset" },
  credit: { label: "信贷", hint: "信用卡、花呗等待还", side: "debt" },
  prepaid: { label: "储值", hint: "交通卡、购物卡", side: "asset" },
  subscribe: { label: "订阅", hint: "会员与周期扣款", side: "plan" },
  receivable: { label: "待收回", hint: "报销、别人欠你", side: "asset" },
  payable: { label: "欠款", hint: "你欠别人的钱", side: "debt" },
  asset: { label: "物品", hint: "闲置可变现资产", side: "asset" },
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "cash",
  "invest",
  "credit",
  "prepaid",
  "subscribe",
  "receivable",
  "payable",
  "asset",
];

export function yuan(n: number, signed = false) {
  const abs = Math.abs(Math.round(n)).toLocaleString("zh-CN");
  if (signed) {
    if (n > 0) return `+¥${abs}`;
    if (n < 0) return `-¥${abs}`;
    return `¥${abs}`;
  }
  return n < 0 ? `-¥${abs}` : `¥${abs}`;
}

export function accountsOf(accounts: MoneyAccount[], type: AccountType) {
  return accounts.filter((a) => a.type === type);
}

export function sumType(accounts: MoneyAccount[], type: AccountType) {
  return accountsOf(accounts, type).reduce((s, a) => s + Number(a.balance || 0), 0);
}

export function defaultCashId(accounts: MoneyAccount[]) {
  const cash = accountsOf(accounts, "cash");
  return (cash.find((a) => a.name.includes("支付宝")) || cash[0])?.id ?? "";
}

export function financeSnap(
  accounts: MoneyAccount[],
  txns: LedgerTxn[],
  bills: { amount: number }[],
  monthBaseIncome: number,
) {
  const spent = txns.filter((t) => t.dir === "out").reduce((s, x) => s + x.amount, 0);
  const extraIn = txns.filter((t) => t.dir === "in").reduce((s, x) => s + x.amount, 0);
  const income = monthBaseIncome + extraIn;
  const liquid = sumType(accounts, "cash");
  const credit = sumType(accounts, "credit");
  const subscribe = sumType(accounts, "subscribe");
  const payable = sumType(accounts, "payable");
  const fixed = bills.reduce((s, x) => s + x.amount, 0) || credit + subscribe;
  return {
    spent,
    extraIn,
    income,
    surplus: income - spent,
    fixed,
    liquid,
    credit,
    invest: sumType(accounts, "invest"),
    receivable: sumType(accounts, "receivable"),
    payable,
    prepaid: sumType(accounts, "prepaid"),
    subscribe,
    assets: sumType(accounts, "asset"),
    free: liquid - fixed - payable,
  };
}

export function whenLabel(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "刚刚";
  const today = new Date();
  if (t.toDateString() === today.toDateString()) return "今天";
  return `${t.getMonth() + 1}月${t.getDate()}日`;
}
