import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Database, Fingerprint, Lock, Shield } from "lucide-react";
import { toast } from "sonner";
import { PageHead, Panel, Section } from "@/components/bits";
import { useFinance } from "@/lib/finance-store";
import { useVault, vaultPublicSummary } from "@/lib/vault-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me")({ component: MePage });

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn("relative h-7 w-11 rounded-full p-0.5 transition", on ? "bg-primary" : "bg-input")}
    >
      <span className={cn("block size-[22px] rounded-full bg-card shadow-sm transition", on && "translate-x-[18px]")} />
    </button>
  );
}

function MePage() {
  const notifyEnabled = useFinance((s) => s.notifyEnabled);
  const setNotifyEnabled = useFinance((s) => s.setNotifyEnabled);
  const autofillEnabled = useVault((s) => s.autofillEnabled);
  const setAutofillEnabled = useVault((s) => s.setAutofillEnabled);
  const vaultItems = useVault((s) => s.items);

  function exportSafe() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            vault: vaultPublicSummary(vaultItems),
            note: "不含密码明文，不含通知原文",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "self-agent-safe.json";
    a.click();
    toast("已导出脱敏副本（不含密码）");
  }

  return (
    <div>
      <PageHead title="我的" caption="权限默认关，确认后才写数据" />
      <Panel className="flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-[18px] bg-secondary text-lg font-semibold text-primary">自</div>
        <div>
          <h2 className="text-[17px] font-semibold">self-agent</h2>
          <p className="text-[11px] text-muted-foreground">本机账本 · 密码库隔离</p>
        </div>
        <span className="ml-auto rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-brand-deep">本机</span>
      </Panel>
      <Section title="系统能力" hint="网页只能记下开关；真机要去系统设置授权">
        <Panel className="py-1">
          <div className="flex items-center gap-3 border-b border-border py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-muted text-primary">
              <Bell className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">支付通知记账</p>
              <p className="text-[10px] text-muted-foreground">只读微信/支付宝/云闪付通知，确认后才入账</p>
            </div>
            <Toggle
              on={notifyEnabled}
              onClick={() => {
                setNotifyEnabled(!notifyEnabled);
                toast(!notifyEnabled ? "已记下：需要系统通知使用权" : "已关闭通知记账");
              }}
            />
          </div>
          <div className="flex items-center gap-3 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-muted text-primary">
              <Fingerprint className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">自动填充密码</p>
              <p className="text-[10px] text-muted-foreground">系统 Autofill，不监听输入框</p>
            </div>
            <Toggle
              on={autofillEnabled}
              onClick={() => {
                setAutofillEnabled(!autofillEnabled);
                toast(!autofillEnabled ? "已记下：需要选 self-agent 为自动填充服务" : "已关闭自动填充");
              }}
            />
          </div>
        </Panel>
      </Section>
      <Section title="安全域">
        <Panel className="py-1">
          <Link to="/vault" className="flex w-full items-center gap-3 border-b border-border py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-muted text-primary">
              <Lock className="size-4" />
            </span>
            <span className="flex-1 text-left">
              <strong className="block text-[13px]">密码库</strong>
              <span className="text-[10px] text-muted-foreground">{vaultItems.length}项 · 不进财务、不进对话</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-muted text-primary">
              <Shield className="size-4" />
            </span>
            <span className="flex-1">
              <strong className="block text-[13px]">不会做的事</strong>
              <span className="text-[10px] text-muted-foreground">不 Hook 微信、不静默改账、不刮密码框</span>
            </span>
          </div>
        </Panel>
      </Section>
      <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3" onClick={exportSafe}>
        <Database className="size-4 text-primary" />
        <span className="text-[13px] font-semibold">导出脱敏数据</span>
      </button>
    </div>
  );
}
