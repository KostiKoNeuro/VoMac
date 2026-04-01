import type { ReactNode } from "react";
import { cn } from "../lib/cn";

interface SettingsRowProps {
  label: string;
  description: string;
  control: ReactNode;
  className?: string;
}

export function SettingsRow({
  label,
  description,
  control,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-[var(--color-border)]/70 py-4 last:border-b-0 last:pb-0 first:pt-0 md:flex-row md:items-center md:justify-between md:gap-6",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{label}</h3>
        <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
      </div>
      <div className="md:w-[280px] md:flex-none">{control}</div>
    </div>
  );
}
