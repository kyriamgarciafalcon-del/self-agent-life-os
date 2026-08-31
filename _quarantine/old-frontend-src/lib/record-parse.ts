import type { PendingTxn } from "./finance-types";
import { guessCategory } from "./pay-parser.ts";

export type ParsedClause =
  | { kind: "spend"; title: string; amount: number; cat: string }
  | { kind: "income"; title: string; amount: number }
  | { kind: "vault"; title: string; user: string; pass: string }
  | { kind: "todo"; title: string };

export function parseRecordText(text: string): ParsedClause[] {
  const items: ParsedClause[] = [];
  const input = text.trim();
  if (!input) return items;

  const incomeHit = input.match(/(?:收入|发了|到账|工资)[^\d]{0,8}(\d+(?:\.\d+)?)\s*元?/);
  if (incomeHit) {
    items.push({ kind: "income", title: `收入${incomeHit[1]}元`, amount: Number(incomeHit[1]) });
  }

  const spend = input.match(/(?:花了|点了|付了|支出)\s*(\d+(?:\.\d+)?)\s*元?/);
  if (spend) {
    const title = /外卖/.test(input) ? "外卖支出" : "支出";
    items.push({
      kind: "spend",
      title: `${title}${spend[1]}元`,
      amount: Number(spend[1]),
      cat: guessCategory(input),
    });
  }

  const vault = input.match(/(.+?)\s*(?:账号|账户|用户名)\s*(?:是|:|：)?\s*(\S+)\s*(?:密码)\s*(?:是|:|：)?\s*(\S+)/);
  if (vault) {
    items.push({
      kind: "vault",
      title: vault[1].replace(/记下|保存|把/g, "").trim() || "账号",
      user: vault[2],
      pass: vault[3].replace(/[。！!]/g, ""),
    });
  }

  const todo = input.match(/(?:提醒我|待办|记得)\s*(.+?)(?:[，。,]|$)/);
  if (todo) items.push({ kind: "todo", title: todo[1].trim() });

  if (!items.length) items.push({ kind: "todo", title: input.slice(0, 28) });
  return items;
}

export function clauseToPending(clause: Extract<ParsedClause, { kind: "spend" | "income" }>): PendingTxn {
  return {
    id: crypto.randomUUID(),
    amount: clause.amount,
    dir: clause.kind === "income" ? "in" : "out",
    title: clause.title,
    source: "other",
    accountHint: "资金账户",
    category: clause.kind === "income" ? "收入" : clause.kind === "spend" ? clause.cat : "其他",
    raw: clause.title,
    at: Date.now(),
  };
}
