import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "border border-emerald-200/45 bg-gradient-to-r from-emerald-200 to-teal-300 text-zinc-900 shadow-[var(--shadow-glow)] hover:brightness-105 active:brightness-95",
  secondary:
    "border border-[var(--color-border)] bg-white/[0.04] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.08] active:bg-white/[0.12]",
  ghost:
    "border border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)] active:bg-white/[0.1]",
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "h-9 rounded-[var(--radius-sm)] px-3 text-sm",
  md: "h-10 rounded-[var(--radius-md)] px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  type = "button",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={cn(
        "ui-interactive ui-focus inline-flex items-center justify-center gap-2 font-medium tracking-[0.01em] disabled:cursor-not-allowed disabled:opacity-45",
        sizeClassMap[size],
        variantClassMap[variant],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </motion.button>
  );
}
