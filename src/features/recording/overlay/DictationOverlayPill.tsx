import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/ui/IconButton";
import { cn } from "../../../lib/cn";
import { useTranslation } from "../../../lib/i18n";
import type { DictationOverlayPillProps } from "./types";
import { OverlayStatusLine } from "./OverlayStatusLine";
import { VoiceOrb } from "./VoiceOrb";

export function DictationOverlayPill({
  state,
  interactive = true,
  timerLabel = "00:00",
  liveText,
  volume = 0,
  errorTitle,
  errorText,
  successText,
  onStart,
  onStop,
  onAbort,
  onRetry,
  onOpenSettings,
}: DictationOverlayPillProps) {
  const { t } = useTranslation();
  const resolvedErrorTitle = errorTitle ?? t("overlay.error.defaultTitle");
  const resolvedErrorText = errorText ?? t("overlay.error.defaultText");
  const resolvedSuccessText = successText ?? t("overlay.success.inserted");

  return (
    <motion.div
      layout
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative mx-auto w-max max-w-full shrink-0 overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(10,14,24,0.86)] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-[14px]",
        state === "listening" && "border-indigo-200/30",
        state === "idle" && "border-white/10",
        state === "processing" && "border-violet-200/25",
        state === "success" && "border-indigo-200/25",
        state === "error" && "border-rose-200/30",
      )}
    >
      {/* Subtle top highlight */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="relative"
        >
          {/* ── IDLE ── */}
          {state === "idle" && (
            <div className="flex h-11 items-center px-2 py-1.5">
              <VoiceOrb
                state="idle"
                volume={volume}
                size={36}
                onClick={interactive ? onStart : undefined}
              />
            </div>
          )}

          {/* ── LISTENING ── */}
          {state === "listening" && (
            <div className="flex h-11 items-center gap-1.5 px-2 py-1.5">
              {/* Orb doubles as the stop button */}
              <VoiceOrb
                state="listening"
                volume={volume}
                size={36}
                onClick={onStop}
              />

              {/* Status bar: timer + live transcript preview */}
              <OverlayStatusLine timerLabel={timerLabel} liveText={liveText} />

              {interactive && (
                <IconButton
                  icon={<X className="h-3.5 w-3.5" />}
                  label={t("overlay.actions.abort")}
                  onClick={onAbort}
                  className="h-9 w-9 shrink-0 rounded-xl"
                />
              )}
            </div>
          )}

          {/* ── PROCESSING ── */}
          {state === "processing" && (
            <div className="flex h-11 items-center gap-2 px-2 py-1.5">
              <VoiceOrb state="processing" volume={volume} size={36} />

              <div className="flex h-9 items-center rounded-xl border border-white/8 bg-white/[0.03] px-3">
                <span className="text-sm font-medium text-[var(--color-text-muted)]">
                  {t("overlay.processing")}
                </span>
              </div>

              {interactive && (
                <IconButton
                  icon={<X className="h-3.5 w-3.5" />}
                  label={t("overlay.actions.abort")}
                  onClick={onAbort}
                  className="h-9 w-9 shrink-0 rounded-xl"
                />
              )}
            </div>
          )}

          {/* ── SUCCESS ── */}
          {state === "success" && (
            <div className="flex h-11 items-center gap-2 px-2 py-1.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-200/25 bg-indigo-200/10 text-indigo-100">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <span className="mr-2 text-sm font-medium text-indigo-100">
                {resolvedSuccessText}
              </span>
            </div>
          )}

          {/* ── ERROR ── */}
          {state === "error" && (
            <div className="px-3 py-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200/30 bg-rose-200/10 text-rose-100">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 max-w-[160px]">
                  <p className="truncate text-xs font-semibold text-rose-100">{resolvedErrorTitle}</p>
                  <p className="truncate text-[11px] text-rose-100/65">{resolvedErrorText}</p>
                </div>
                {interactive && (
                  <IconButton
                    icon={<X className="h-3 w-3" />}
                    label={t("overlay.actions.dismiss")}
                    onClick={onAbort ?? onOpenSettings}
                    className="h-8 w-8 shrink-0 rounded-lg"
                  />
                )}
              </div>
              {interactive && onRetry && (
                <div className="mt-1.5 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<RotateCcw className="h-3 w-3" />}
                    onClick={onRetry}
                    className="h-7 rounded-lg border-white/[0.06] bg-rose-200/8 px-2.5 text-xs text-rose-100 hover:bg-rose-200/15"
                  >
                    {t("overlay.actions.retry")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
