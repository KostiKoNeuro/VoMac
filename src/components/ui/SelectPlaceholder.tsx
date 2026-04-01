import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

interface SelectPlaceholderProps {
  label: string;
  placeholder?: string;
  value?: string;
  hint?: string;
  className?: string;
}

export function SelectPlaceholder({
  label,
  placeholder = "Select option",
  value,
  hint,
  className,
}: SelectPlaceholderProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <span className="ui-subtle text-[11px] uppercase tracking-[0.16em]">
        {label}
      </span>
      <button
        type="button"
        className="ui-interactive ui-focus flex h-10 items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/[0.03] px-3 text-left text-sm hover:border-[var(--color-border-strong)] hover:bg-white/[0.06]"
      >
        <span className={value ? "text-[var(--color-text-primary)]" : "ui-subtle"}>
          {value ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 ui-subtle" />
      </button>
      {hint ? <span className="ui-subtle text-xs">{hint}</span> : null}
    </div>
  );
}
