import type { PaySource, PendingTxn } from "./finance-types";

export const PAY_PACKAGES: Record<string, PaySource> = {
  "com.tencent.mm": "wechat",
  "com.eg.android.AlipayGphone": "alipay",
  "com.unionpay": "unionpay",
};

const PAY_HINT = /支付成功|付款成功|已支付|已付款|消费成功|转账成功|收款成功|到账|收款/;

export const DEMO_NOTICES: { pkg: string; raw: string }[] = [
  { pkg: "com.eg.android.AlipayGphone", raw: "支付宝 支付成功 向星巴克支付 ¥36.00" },
  { pkg: "com.tencent.mm", raw: "微信支付 支付成功 已付款" },
  { pkg: "com.eg.android.AlipayGphone", raw: "支付宝 收款到账 ¥200.00 来自张三" },
  { pkg: "com.unionpay", raw: "云闪付 消费成功 ¥18.50 地铁" },
];

export function isPayText(raw: string) {
  return PAY_HINT.test(raw);
}

export function sourceOf(pkg: string): PaySource {
  return PAY_PACKAGES[pkg] ?? "other";
}

export function parseAmount(raw: string): number | null {
  const yen = raw.match(/[¥￥]\s*(\d+(?:\.\d{1,2})?)/);
  if (yen) return Number(yen[1]);
  const yuan = raw.match(/(\d+(?:\.\d{1,2})?)\s*元/);
  if (yuan) return Number(yuan[1]);
  return null;
}

export function guessMerchant(raw: string): string | null {
  const toward = raw.match(/(?:向|给)\s*([^\s，。,¥￥支付付款成功]{2,16})/);
  if (toward) return toward[1].replace(/支付|付款/g, "").trim() || null;
  const from = raw.match(/(?:来自|商户|商家)[:：]?\s*([^\s，。,¥￥]{2,16})/);
  if (from) return from[1].trim();
  if (/外卖/.test(raw)) return "外卖";
  if (/地铁/.test(raw)) return "地铁";
  return null;
}

export function guessCategory(text: string) {
  if (/餐|饭|面|外卖|咖啡|奶茶|星巴克/.test(text)) return "餐饮";
  if (/地铁|打车|滴滴|公交|加油|交通/.test(text)) return "交通";
  if (/超市|购物|淘宝|京东|拼多多/.test(text)) return "购物";
  if (/会员|订阅|视频/.test(text)) return "订阅";
  return "其他";
}

export function parsePayText(pkg: string, raw: string, at = Date.now()): PendingTxn | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || !isPayText(text)) return null;
  const source = sourceOf(pkg);
  const amount = parseAmount(text);
  const incoming = /收款|到账/.test(text) && !/支付成功|付款成功|已支付|消费成功/.test(text);
  const merchant = guessMerchant(text);
  const title =
    merchant ||
    (source === "wechat" ? "微信支付" : source === "alipay" ? "支付宝" : source === "unionpay" ? "云闪付" : "支付");
  return {
    id: crypto.randomUUID(),
    amount,
    dir: incoming ? "in" : "out",
    title,
    source,
    accountHint: source === "alipay" ? "支付宝" : source === "wechat" ? "微信零钱/银行卡" : "资金账户",
    category: incoming ? "收入" : guessCategory(text + (merchant ?? "")),
    raw: text,
    at,
  };
}

export function isDuplicate(a: PendingTxn, b: PendingTxn) {
  return a.source === b.source && a.amount === b.amount && a.title === b.title && Math.abs(a.at - b.at) < 10_000;
}
