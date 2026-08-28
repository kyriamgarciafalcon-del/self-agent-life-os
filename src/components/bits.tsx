import { useRouter } from "@tanstack/react-router";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHead({
  title,
  caption,
  back,
  right,
}: {
  title: string;
  caption?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 mb-3 grid grid-cols-[44px_1fr_44px] items-center gap-2 bg-background/95 py-2 backdrop-blur-sm">
      {back ? (
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card"
          aria-label="返回"
          onClick={() => router.history.back()}
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : (
        <span />
      )}
      <div className="text-center">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {caption ? <p className="text-[11px] font-medium text-muted-foreground">{caption}</p> : null}
      </div>
      <div className="flex justify-end">{right ?? <span />}</div>
    </header>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2.5 flex items-end justify-between px-0.5">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function IconBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card"
    >
      <Icon className="size-5" />
    </button>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[18px] border border-border bg-card p-4", className)}>{children}</div>
  );
}
