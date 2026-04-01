import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  icon: ReactNode;
  label: string;
  tone?: "default" | "accent";
}

export function IconButton({
  icon,
  label,
  tone = "default",
  type = "button",
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <motion.button
      type={type}
      aria-label={label}
      title={label}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cn(
        "ui-interactive ui-focus inline-grid h-9 w-9 place-content-center rounded-[var(--radius-sm)] border",
        tone === "accent"
          ? "border-emerald-200/40 bg-emerald-200/15 text-emerald-100 hover:bg-emerald-200/22"
          : "border-[var(--color-border)] bg-white/[0.035] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.08] hover:text-[var(--color-text-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
    </motion.button>
  );
}
