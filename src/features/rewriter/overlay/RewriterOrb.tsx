import { motion } from "motion/react";

const SIZE = 22;

/** Compact non-interactive orb shown while a rewrite is in flight.
 *  Mirrors the recording overlay's "processing" orb palette (VoiceOrb). */
export function RewriterOrb() {
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} aria-hidden>
      {/* Breathing halo */}
      <motion.div
        className="absolute rounded-full blur-md"
        style={{ inset: "-30%", background: "rgba(139, 92, 246, 0.45)" }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />

      {/* Rotating energy ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, rgba(196, 181, 253, 0.95) 18%, transparent 42%, transparent 55%, rgba(196, 181, 253, 0.95) 72%, transparent 95%)",
          WebkitMaskImage:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 2px))",
          maskImage:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), black calc(100% - 2px))",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
      />

      {/* Core */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, #f5f3ff 0%, #c4b5fd 32%, #8b5cf6 66%, #4c1d95 100%)",
          boxShadow:
            "inset 0 2px 5px rgba(255,255,255,0.45), inset 0 -4px 8px rgba(15,10,50,0.45), 0 2px 10px -2px rgba(139, 92, 246, 0.55)",
        }}
        animate={{ scale: [0.92, 1.04, 0.92] }}
        transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
    </div>
  );
}
