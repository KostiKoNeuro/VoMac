import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
