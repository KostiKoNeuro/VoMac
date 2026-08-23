import { useTranslation } from "../../../lib/i18n";

interface OverlayStatusLineProps {
  timerLabel: string;
  /** Live streaming transcript; when absent, shows the idle listening hint. */
  liveText?: string;
}

/**
 * Single-line status strip inside the dictation pill: timer plus either the
 * live transcript preview or a static hint. Always width-capped by its
 * container — long transcripts truncate with an ellipsis instead of growing.
 */
export function OverlayStatusLine({
  timerLabel,
  liveText,
}: OverlayStatusLineProps) {
  const { t } = useTranslation();

  // Show the tail of the transcript: the newest words are what matters while
  // dictating, the beginning would just sit frozen at "first three words".
  const TAIL_LENGTH = 44;
  const tailText =
    liveText && liveText.length > TAIL_LENGTH
      ? `…${liveText.slice(-TAIL_LENGTH)}`
      : liveText;

  return (
    <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/[0.04] px-3">
      <span className="shrink-0 font-mono text-[11px] font-medium tracking-[0.05em] text-[var(--color-text-muted)]">
        {timerLabel}
      </span>
      {tailText ? (
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-primary)]">
          {tailText}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-subtle)]">
          {t("overlay.listening")}
        </span>
      )}
    </div>
  );
}
