export type AccountType =
  | "cash"
  | "invest"
  | "credit"
  | "prepaid"
  | "subscribe"
  | "receivable"
  | "payable"
  | "asset";

export type AccountSide = "asset" | "debt" | "plan";

export type MoneyAccount = {
  id: string;
  type: AccountType;
  name: string;
  balance: number;
  note: string;
};

export type LedgerTxn = {
  id: string;
  at: string;
  title: string;
  amount: number;
  cat: string;
  accountId: string;
  dir: "in" | "out";
  source?: "manual" | "notify" | "parse";
  raw?: string;
};

export type UpcomingBill = {
  id: string;
  title: string;
  sub: string;
  amount: number;
  when: string;
  accountId: string;
};

export type PaySource = "wechat" | "alipay" | "unionpay" | "other";

export type PendingTxn = {
  id: string;
  amount: number | null;
  dir: "in" | "out";
  title: string;
  source: PaySource;
  accountHint: string;
  category: string;
  raw: string;
  at: number;
};
