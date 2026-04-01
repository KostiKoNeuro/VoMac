import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Mic,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { IconButton } from "../../../components/ui/IconButton";
import { cn } from "../../../lib/cn";
import { useTranslation } from "../../../lib/i18n";
import { OverlayWaveform } from "./OverlayWaveform";
import type { DictationOverlayPillProps } from "./types";

export function DictationOverlayPill({
  state,
  interactive = true,
  timerLabel = "00:00",
  errorTitle,
  errorText,
  successText,
  waveformLevels,
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
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative mx-auto w-max shrink-0 overflow-hidden rounded-[20px] border border-white/12 bg-[rgba(16,22,33,0.92)] shadow-[0_16px_32px_-16px_rgba(0,0,0,0.95)] backdrop-blur-[18px]",
        state === "listening" && "border-emerald-200/35",
        state === "processing" && "border-cyan-200/28",
        state === "success" && "border-emerald-200/28 bg-[rgba(16,22,33,0.95)]",
        state === "error" && "border-rose-200/35 bg-[rgba(16,22,33,0.98)]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-200/[0.04] via-transparent to-cyan-200/[0.04]" />

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative"
        >
          {state === "idle" ? (
            <div className="flex h-[56px] items-center gap-2 px-2 py-2">
              {interactive ? (
                <IconButton
                  icon={<Mic className="h-4 w-4" />}
                  label={t("overlay.actions.start")}
                  tone="accent"
                  onClick={onStart}
                  className="h-10 w-10 shrink-0 rounded-[14px]"
                />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-content-center rounded-[14px] border border-white/15 bg-white/[0.04] text-[var(--color-text-muted)]">
                  <Mic className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 pr-2">
                <div className="flex h-[40px] items-center overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.03] px-3.5">
                  <OverlayWaveform active={false} levels={waveformLevels} className="gap-1.5" />
                </div>
              </div>
            </div>
          ) : null}

          {state === "listening" ? (
            <div className="flex h-[56px] items-center gap-2 px-2 py-2">
              <IconButton
                icon={<Square className="h-3.5 w-3.5 fill-current" />}
                label={t("overlay.actions.stop")}
                tone="accent"
                onClick={onStop}
                className="h-10 w-10 shrink-0 rounded-[14px]"
              />

              <div className="min-w-0 pr-1">
                <div className="flex h-[40px] items-center gap-3 overflow-hidden rounded-[14px] border border-white/10 bg-white/[0.03] px-3.5">
                  <div className="min-w-[80px] shrink-0 overflow-hidden">
                    <OverlayWaveform active levels={waveformLevels} className="min-w-0 gap-1.5" />
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-medium tracking-[0.04em] text-[var(--color-text-muted)]">
                    {timerLabel}
                  </span>
                </div>
              </div>

              {interactive ? (
                <div className="pr-1">
                  <IconButton
                    icon={<X className="h-3.5 w-3.5" />}
                    label={t("overlay.actions.abort")}
                    onClick={onAbort}
                    className="h-8 w-8 shrink-0 rounded-[10px]"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {state === "processing" ? (
            <div className="flex h-[56px] items-center gap-2 px-2 py-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1, ease: "linear" }}
                className="grid h-10 w-10 shrink-0 place-content-center rounded-[14px] border border-cyan-200/28 bg-cyan-200/10 text-cyan-100"
              >
                <LoaderCircle className="h-4 w-4" />
              </motion.div>

              <div className="min-w-[120px] px-2 text-center">
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {t("overlay.processing")}
                </p>
              </div>

              {interactive ? (
                <div className="flex items-center pr-1">
                  <IconButton
                    icon={<X className="h-3.5 w-3.5" />}
                    label={t("overlay.actions.abort")}
                    onClick={onAbort}
                    className="h-8 w-8 shrink-0 rounded-[10px]"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {state === "success" ? (
            <div className="flex h-[56px] items-center gap-2 bg-emerald-200/10 px-2.5 py-2">
              <div className="grid h-10 w-10 shrink-0 place-content-center rounded-[14px] border border-emerald-200/28 bg-emerald-200/15 text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="min-w-[120px] px-2 text-left">
                <p className="truncate text-sm font-semibold text-emerald-100">
                  {resolvedSuccessText}
                </p>
              </div>
            </div>
          ) : null}

          {state === "error" ? (
            <div className="bg-rose-200/[0.08] px-3 py-2.5">
              <div className="grid grid-cols-[40px,1fr,30px] items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-content-center rounded-[14px] border border-rose-200/35 bg-rose-200/14 text-rose-100">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="min-w-[180px]">
                  <p className="truncate text-xs font-semibold text-rose-100">{resolvedErrorTitle}</p>
                  <p className="mt-0.5 max-w-[180px] text-[11px] leading-tight text-rose-100/75">{resolvedErrorText}</p>
                </div>
                {interactive ? (
                  <IconButton
                    icon={<X className="h-3.5 w-3.5" />}
                    label={t("overlay.actions.dismiss")}
                    onClick={onAbort ?? onOpenSettings}
                    className="h-8 w-8 shrink-0 self-start rounded-[10px]"
                  />
                ) : null}
              </div>
              {interactive && onRetry ? (
                <div className="mt-2.5 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                    onClick={onRetry}
                    className="h-7 rounded-[10px] border-white/5 bg-rose-200/10 px-2.5 text-xs text-rose-100 hover:bg-rose-200/20"
                  >
                    {t("overlay.actions.retry")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}