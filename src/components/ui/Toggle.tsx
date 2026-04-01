import { motion } from "motion/react";
import { cn } from "../../lib/cn";

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (nextValue: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "ui-interactive ui-focus relative inline-flex h-6 w-11 items-center rounded-full border",
        checked
          ? "border-emerald-200/60 bg-emerald-200/85"
          : "border-[var(--color-border)] bg-white/[0.07]",
        disabled ? "cursor-not-allowed opacity-50" : "hover:border-[var(--color-border-strong)]",
      )}
    >
      <motion.span
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 430, damping: 30, mass: 0.2 }}
        className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
      />
    </button>
  );
}
