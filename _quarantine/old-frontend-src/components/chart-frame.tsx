import { useEffect, useState, type ReactNode } from "react";

export function ChartFrame({ children, className }: { children: ReactNode; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className={className ?? "h-52 rounded-xl bg-secondary/40"} />;
  return <>{children}</>;
}

export const chartAxis = { fill: "var(--color-muted-foreground)", fontSize: 11 };
export const chartGrid = "color-mix(in oklab, var(--color-foreground) 6%, transparent)";
export const chartTooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  color: "var(--color-foreground)",
};
