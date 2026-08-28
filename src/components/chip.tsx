import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full border px-3 text-[11px] font-semibold",
        active ? "border-primary/25 bg-secondary text-brand-deep" : "border-border bg-card text-ink",
      )}
    >
      {children}
    </button>
  );
}
