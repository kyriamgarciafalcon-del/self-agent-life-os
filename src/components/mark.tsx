import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-foreground", className)} aria-hidden>
      <rect x="3.5" y="3.5" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 7.5v17M22 7.5v17M7.5 12h17M7.5 20h17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
