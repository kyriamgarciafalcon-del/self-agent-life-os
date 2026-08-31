import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPayText, parseAmount, parsePayText, guessMerchant, isDuplicate } from "./pay-parser.ts";
import { parseRecordText } from "./record-parse.ts";

describe("pay parser", () => {
  it("reads alipay amount and merchant", () => {
    const p = parsePayText("com.eg.android.AlipayGphone", "支付宝 支付成功 向星巴克支付 ¥36.00");
    assert.ok(p);
    assert.equal(p.source, "alipay");
    assert.equal(p.amount, 36);
    assert.equal(p.dir, "out");
    assert.equal(p.title, "星巴克");
    assert.equal(p.category, "餐饮");
  });
  it("leaves wechat amount empty when notification has none", () => {
    const p = parsePayText("com.tencent.mm", "微信支付 支付成功 已付款");
    assert.ok(p);
    assert.equal(p.amount, null);
    assert.equal(p.source, "wechat");
  });
  it("treats 收款到账 as income", () => {
    const p = parsePayText("com.eg.android.AlipayGphone", "支付宝 收款到账 ¥200.00 来自张三");
    assert.ok(p);
    assert.equal(p.dir, "in");
    assert.equal(p.amount, 200);
  });
  it("ignores chat that is not a payment", () => {
    assert.equal(isPayText("今晚吃饭吗"), false);
    assert.equal(parsePayText("com.tencent.mm", "今晚吃饭吗"), null);
  });
  it("does not grab stray numbers as amount", () => {
    assert.equal(parseAmount("支付成功 订单号 20260828001"), null);
    assert.equal(parseAmount("已付款 18元"), 18);
  });
  it("dedups the same notice within 10s", () => {
    const a = parsePayText("com.unionpay", "云闪付 消费成功 ¥18.50 地铁", 1000)!;
    const b = parsePayText("com.unionpay", "云闪付 消费成功 ¥18.50 地铁", 2000)!;
    assert.equal(isDuplicate(a, b), true);
  });
  it("guesses merchant from 向", () => {
    assert.equal(guessMerchant("向星巴克支付 ¥36"), "星巴克");
  });
});

describe("record parse", () => {
  it("splits spend and vault without auto-saving", () => {
    const items = parseRecordText("晚上点了58元外卖，记下邮箱账号是 me@x.com 密码是 secret1");
    assert.equal(items.some((i) => i.kind === "spend" && i.amount === 58), true);
    const vault = items.find((i) => i.kind === "vault");
    assert.ok(vault && vault.kind === "vault");
    assert.equal(vault.user, "me@x.com");
  });
});
