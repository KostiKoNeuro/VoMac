import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label: string;
  options: SelectOption[];
  hint?: string;
  className?: string;
}

export function Select({
  id,
  label,
  options,
  hint,
  className,
  ...props
}: SelectProps) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;

  return (
    <label className={cn("grid gap-1.5", className)} htmlFor={selectId}>
      <span className="ui-subtle text-[11px] uppercase tracking-[0.16em]">
        {label}
      </span>
      <select
        id={selectId}
        className="ui-interactive ui-focus h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/[0.03] px-3 text-sm text-[var(--color-text-primary)] outline-none hover:border-[var(--color-border-strong)] focus:border-emerald-200/45 focus:bg-white/[0.06]"
        {...props}
      >
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            style={{ background: '#0d121b', color: '#e8edf6' }}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="ui-subtle text-xs">{hint}</span> : null}
    </label>
  );
}
