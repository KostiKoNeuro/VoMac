import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  tone?: "glass" | "soft";
}

const paddingClassMap: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  children,
  hoverable = false,
  padding = "md",
  tone = "glass",
  className,
  ...props
}: CardProps) {
  return (
    <motion.div
      whileHover={hoverable ? { y: -2 } : undefined}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        tone === "glass" ? "ui-surface" : "ui-surface-soft",
        "rounded-[var(--radius-lg)]",
        paddingClassMap[padding],
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
