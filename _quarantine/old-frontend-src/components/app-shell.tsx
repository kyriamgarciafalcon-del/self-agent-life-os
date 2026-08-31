import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Sun, Wallet, Plus, UserRound } from "lucide-react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAgenda } from "@/lib/store";
import { useFinance } from "@/lib/finance-store";
import { useVault } from "@/lib/vault-store";
import { installNativeBridge } from "@/lib/native-bridge";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "首页", icon: Sun },
  { to: "/calendar", label: "日程", icon: CalendarDays },
  { to: "/record", label: "记录", icon: Plus },
  { to: "/finance", label: "财务", icon: Wallet },
  { to: "/me", label: "我的", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideFab = pathname.startsWith("/add") || pathname.startsWith("/item") || pathname.startsWith("/record") || pathname.startsWith("/vault");

  useEffect(() => {
    void useAgenda.persist.rehydrate();
    void useFinance.persist.rehydrate();
    void useVault.persist.rehydrate();
    installNativeBridge();
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/vault")) useVault.getState().lock();
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-canvas text-foreground">
        <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background shadow-[var(--shadow-lift)]">
          <main className="flex-1 px-4 pb-28 pt-2">{children}</main>
          {!hideFab ? (
            <Link
              to="/record"
              aria-label="记录"
              className="absolute right-4 bottom-[92px] z-40 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-lift)]"
            >
              <Plus className="size-6" />
            </Link>
          ) : null}
          <BottomNav />
        </div>
      </div>
      <Toaster
        theme="light"
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "bg-foreground text-background border-none font-sans text-xs",
          },
        }}
      />
    </TooltipProvider>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pending = useFinance((s) => s.pending.length);
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 grid h-[76px] w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-border bg-card/95 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur-md">
      {NAV.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/"
            : item.to === "/finance"
              ? pathname.startsWith("/finance")
              : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[13px] text-[10px] font-semibold",
              active ? "text-brand-deep" : "text-muted-foreground",
            )}
          >
            <span className={cn("inline-flex size-9 items-center justify-center rounded-xl", active && "bg-secondary")}>
              <Icon className="size-5" />
            </span>
            {item.label}
            {item.to === "/record" && pending ? (
              <span className="absolute top-1 right-3 size-1.5 rounded-full bg-destructive" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
