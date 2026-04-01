import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type PillBadgeTone = "neutral" | "accent" | "success" | "error";

interface PillBadgeProps {
  children: ReactNode;
  tone?: PillBadgeTone;
  className?: string;
}

const toneClassMap: Record<PillBadgeTone, string> = {
  neutral: "border-white/14 bg-white/[0.06] text-[var(--color-text-muted)]",
  accent: "border-cyan-200/30 bg-cyan-200/12 text-cyan-100",
  success: "border-emerald-200/30 bg-emerald-200/12 text-emerald-100",
  error: "border-rose-200/30 bg-rose-200/12 text-rose-100",
};

export function PillBadge({
  children,
  tone = "neutral",
  className,
}: PillBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.01em]",
        toneClassMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
