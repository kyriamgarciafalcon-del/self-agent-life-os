import { parsePayText } from "./pay-parser";
import { useFinance } from "./finance-store";
import type { PendingTxn } from "./finance-types";

declare global {
  interface Window {
    onAutoTxn?: (payload: NativeAutoTxn) => void;
    onAutofillSave?: (payload: NativeAutofill) => void;
  }
}

export type NativeAutoTxn = {
  pkg?: string;
  raw?: string;
  amount?: number | null;
  title?: string;
  source?: PendingTxn["source"];
  dir?: PendingTxn["dir"];
};

export type NativeAutofill = {
  app?: string;
  username?: string;
  password?: string;
};

function normalize(payload: NativeAutoTxn): PendingTxn | null {
  if (payload.raw) return parsePayText(payload.pkg ?? "", payload.raw);
  if (payload.title && (payload.amount || payload.amount === 0)) {
    return parsePayText(payload.pkg ?? "", `${payload.title} 支付成功 ¥${payload.amount}`);
  }
  return null;
}

export function installNativeBridge() {
  if (typeof window === "undefined") return;
  window.onAutoTxn = (payload) => {
    const pending = normalize(payload);
    if (!pending) return;
    useFinance.getState().enqueuePending(pending);
  };
}
