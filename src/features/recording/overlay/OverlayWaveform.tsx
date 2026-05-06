import { motion } from "motion/react";
import { cn } from "../../../lib/cn";

interface OverlayWaveformProps {
  active: boolean;
  levels?: number[];
  className?: string;
}

const baseHeights = [22, 30, 18, 34, 26, 32, 24, 28, 20, 30];

export function OverlayWaveform({ active, levels, className }: OverlayWaveformProps) {
  const hasLiveLevels = Array.isArray(levels) && levels.length > 0;
  const bars = hasLiveLevels ? levels : baseHeights.map(() => 0.3);

  return (
    <div className={cn("flex min-w-[78px] items-end gap-1.5", className)}>
      {bars.map((level, index) => (
        <motion.span
          key={`bar-${index}`}
          className="w-1.5 rounded-full bg-gradient-to-t from-indigo-300/95 to-violet-200/95"
          style={{ height: baseHeights[index] ?? 24, transformOrigin: "50% 100%" }}
          animate={
            !active
              ? {
                  scaleY: 0.24,
                  opacity: 0.45,
                }
              : hasLiveLevels
              ? {
                  scaleY: 0.42 + Math.min(1, Math.max(0.12, level)) * 0.72,
                  opacity: 0.76 + Math.min(1, Math.max(0.12, level)) * 0.24,
                }
              : {
                  scaleY: [0.32, 1, 0.5, 0.84, 0.42],
                  opacity: [0.7, 1, 0.85, 1, 0.75],
                }
          }
          transition={
            active && !hasLiveLevels
              ? {
                  duration: 1 + index * 0.035,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: index * 0.05,
                }
              : {
                  duration: 0.14,
                  ease: "easeOut",
                }
          }
        />
      ))}
    </div>
  );
}
