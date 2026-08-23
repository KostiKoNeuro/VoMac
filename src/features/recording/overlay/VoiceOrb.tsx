import { useEffect } from "react";
import {
  motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Mic, Square } from "lucide-react";
import { cn } from "../../../lib/cn";
import type { OverlayPillState } from "./types";

interface VoiceOrbProps {
  state: OverlayPillState;
  /** Continuous mic loudness, 0..1. */
  volume: number;
  size?: number;
  onClick?: () => void;
  className?: string;
}

const PALETTE: Record<
  OverlayPillState,
  { core: string; halo: string; ring: string; ringOpacity: number }
> = {
  idle: {
    core:
      "radial-gradient(circle at 34% 28%, #e0e7ff 0%, #a5b4fc 32%, #6366f1 68%, #3730a3 100%)",
    halo: "rgba(99, 102, 241, 0.35)",
    ring: "rgba(165, 180, 252, 0.85)",
    ringOpacity: 0.4,
  },
  listening: {
    core:
      "radial-gradient(circle at 34% 28%, #eef2ff 0%, #a5b4fc 30%, #6d5df1 62%, #2e2a7a 100%)",
    halo: "rgba(109, 93, 241, 0.5)",
    ring: "rgba(165, 180, 252, 0.95)",
    ringOpacity: 0.9,
  },
  processing: {
    core:
      "radial-gradient(circle at 34% 28%, #f5f3ff 0%, #c4b5fd 32%, #8b5cf6 66%, #4c1d95 100%)",
    halo: "rgba(139, 92, 246, 0.45)",
    ring: "rgba(196, 181, 253, 0.95)",
    ringOpacity: 0.85,
  },
  success: {
    core:
      "radial-gradient(circle at 34% 28%, #ecfdf5 0%, #6ee7b7 32%, #10b981 68%, #065f46 100%)",
    halo: "rgba(16, 185, 129, 0.4)",
    ring: "rgba(110, 231, 183, 0.9)",
    ringOpacity: 0.7,
  },
  error: {
    core:
      "radial-gradient(circle at 34% 28%, #fff1f2 0%, #fda4af 32%, #f43f5e 68%, #881337 100%)",
    halo: "rgba(244, 63, 94, 0.4)",
    ring: "rgba(253, 164, 175, 0.9)",
    ringOpacity: 0.7,
  },
};

/** Slow ambient breathing for the halo, independent of mic input. */
function haloBreath(state: OverlayPillState) {
  if (state === "listening") {
    return { scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] };
  }
  if (state === "processing") {
    return { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] };
  }
  return { scale: [0.96, 1.03, 0.96], opacity: [0.5, 0.8, 0.5] };
}

export function VoiceOrb({
  state,
  volume,
  size = 64,
  onClick,
  className,
}: VoiceOrbProps) {
  const palette = PALETTE[state];
  const interactive = Boolean(onClick) && (state === "idle" || state === "listening");

  // Spring-smoothed loudness keeps the orb fluid without re-render churn.
  const loudness: MotionValue<number> = useSpring(0.12, {
    stiffness: 130,
    damping: 16,
    mass: 0.6,
  });

  useEffect(() => {
    const target =
      state === "listening" ? 0.14 + volume * 0.86 : 0.1 + volume * 0.15;
    loudness.set(target);
  }, [volume, state, loudness]);

  const coreScale = useTransform(loudness, (v) => 0.86 + v * 0.26);
  const haloScale = useTransform(loudness, (v) => 1 + v * 0.45);
  const ringScale = useTransform(loudness, (v) => 0.94 + v * 0.14);
  const ringSpeed = state === "processing" ? 1.4 : state === "listening" ? 5.5 : 9;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Outer halo */}
      <motion.div
        aria-hidden
        className="absolute rounded-full blur-lg"
        style={{ inset: "-24%", background: palette.halo, scale: haloScale }}
        animate={haloBreath(state)}
        transition={{ duration: state === "idle" ? 3.4 : 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      {/* Rotating energy ring */}
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${palette.ring} 18%, transparent 42%, transparent 55%, ${palette.ring} 72%, transparent 95%)`,
          WebkitMaskImage:
            "radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 3px))",
          maskImage:
            "radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 3px))",
          opacity: palette.ringOpacity,
          scale: ringScale,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: ringSpeed, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      />

      {/* Core */}
      <motion.button
        type="button"
        aria-label={state === "listening" ? "Stop dictation" : "Start dictation"}
        onClick={interactive ? onClick : undefined}
        tabIndex={interactive ? 0 : -1}
        className={cn(
          "absolute inset-0 grid place-items-center rounded-full",
          interactive && "ui-interactive cursor-pointer",
        )}
        style={{
          background: palette.core,
          boxShadow:
            "inset 0 2px 6px rgba(255,255,255,0.45), inset 0 -6px 12px rgba(15,10,50,0.45), 0 4px 18px -4px rgba(79, 70, 229, 0.55)",
          scale: coreScale,
        }}
      >
        {state === "idle" && (
          <Mic className="h-[38%] w-[38%] text-white/90 drop-shadow" />
        )}
        {state === "listening" && (
          <motion.span
            className="grid place-items-center rounded-full bg-white/15 backdrop-blur-[1px]"
            style={{ width: "44%", height: "44%" }}
          >
            <Square className="h-[38%] w-[38%] fill-white text-white" />
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
