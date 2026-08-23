import { useId, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  hint?: string;
  className?: string;
}

export function Input({
  id,
  label,
  hint,
  className,
  ...props
}: InputProps) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;

  return (
    <label className={cn("grid gap-1.5", className)} htmlFor={fieldId}>
      <span className="ui-subtle text-[11px] uppercase tracking-[0.16em]">
        {label}
      </span>
      <input
        id={fieldId}
        className="ui-interactive ui-focus h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white/[0.03] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-subtle)] hover:border-[var(--color-border-strong)] focus:border-indigo-200/45 focus:bg-white/[0.06]"
        {...props}
      />
      {hint ? <span className="ui-subtle text-xs">{hint}</span> : null}
    </label>
  );
}
