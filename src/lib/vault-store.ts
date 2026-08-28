import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "./utils";

export type Credential = {
  id: string;
  title: string;
  username: string;
  password: string;
  note: string;
  source: "manual" | "autofill";
  at: string;
};

type VaultState = {
  items: Credential[];
  unlocked: boolean;
  autofillEnabled: boolean;
  unlock: () => void;
  lock: () => void;
  add: (draft: Omit<Credential, "id" | "at">) => void;
  remove: (id: string) => void;
  setAutofillEnabled: (on: boolean) => void;
};

export const useVault = create<VaultState>()(
  persist(
    (set) => ({
      items: [
        { id: "v1", title: "招商银行", username: "已保存", password: "", note: "双重验证已开启", source: "manual", at: new Date().toISOString() },
        { id: "v2", title: "个人邮箱", username: "已保存", password: "", note: "密码8个月未更新", source: "manual", at: new Date().toISOString() },
        { id: "v3", title: "云盘账号", username: "已保存", password: "", note: "状态安全", source: "manual", at: new Date().toISOString() },
      ],
      unlocked: false,
      autofillEnabled: false,
      unlock: () => set({ unlocked: true }),
      lock: () => set({ unlocked: false }),
      add: (draft) =>
        set((s) => ({
          items: [
            { ...draft, id: uid(), at: new Date().toISOString() },
            ...s.items,
          ],
        })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setAutofillEnabled: (on) => set({ autofillEnabled: on }),
    }),
    {
      name: "self-agent-vault-v1",
      skipHydration: true,
      partialize: (s) => ({
        items: s.items,
        autofillEnabled: s.autofillEnabled,
      }),
    },
  ),
);

export function vaultPublicSummary(items: Credential[]) {
  return items.map((i) => ({ title: i.title, username: i.username, note: i.note, source: i.source }));
}
