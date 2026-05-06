import { useEffect, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Wand2,
  Languages,
  SpellCheck2,
  AlignLeft,
  Highlighter,
  Quote,
  Hash,
  SplitSquareHorizontal,
  Keyboard,
  FileText,
  Zap,
  Sparkles,
  SendHorizontal,
} from "lucide-react";
import { APP_EVENT_REWRITER_TRIGGERED, APP_EVENT_REWRITER_ABORT } from "../../../lib/tauri/events";
import { useTranslation } from "../../../lib/i18n";
import { loadSharedRewriterSettings } from "../../../lib/sharedState";
import { useRewriterSession } from "../lib/useRewriterSession";
import type { RewriterPreset } from "../types";
import type { LucideProps } from "lucide-react";

interface RewriterTriggeredPayload {
  sequence: number;
  selectedText: string;
}

/* ── Icon map ── */
const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  sparkles:    Sparkles,
  wand2:       Wand2,
  languages:   Languages,
  spellcheck2: SpellCheck2,
  alignleft:   AlignLeft,
  highlighter: Highlighter,
  quote:       Quote,
  hash:        Hash,
  split:       SplitSquareHorizontal,
  keyboard:    Keyboard,
  file:        FileText,
  zap:         Zap,
};

function PresetIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICON_MAP[icon] ?? Sparkles;
  return <Icon className={className} />;
}

export function RewriterOverlayWindow() {
  const { t } = useTranslation();
  const overlayWindow = useMemo(() => getCurrentWindow(), []);

  const {
    phase, selectedText, customPrompt, setCustomPrompt,
    resultText, presets, errorText,
    startSession, abortSession, sendPrompt,
    insertResult, rewriteResult, copyResult,
  } = useRewriterSession({ getLatestRewriterSettings: loadSharedRewriterSettings });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "input") setTimeout(() => inputRef.current?.focus(), 100);
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let unlistenTriggered: (() => void) | null = null;
    let unlistenAbort: (() => void) | null = null;

    async function setup() {
      const cleanups = await Promise.all([
        overlayWindow.listen<RewriterTriggeredPayload>(APP_EVENT_REWRITER_TRIGGERED, (ev) => {
          void startSession(ev.payload.selectedText);
        }),
        overlayWindow.listen(APP_EVENT_REWRITER_ABORT, () => abortSession()),
      ]);

      if (cancelled) {
        cleanups.forEach((fn) => fn());
        return;
      }
      unlistenTriggered = cleanups[0];
      unlistenAbort = cleanups[1];
      await invoke("mark_rewriter_ready");
    }

    void setup();
    return () => { cancelled = true; unlistenTriggered?.(); unlistenAbort?.(); };
  }, [overlayWindow, startSession, abortSession]);

  useEffect(() => {
    if (phase === "idle") {
      void invoke("schedule_rewriter_hide", { delayMs: 300 });
    } else {
      void invoke("cancel_rewriter_hide");
      void overlayWindow.show();
    }
  }, [phase, overlayWindow]);

  useEffect(() => {
    void overlayWindow.setAlwaysOnTop(true);
    void overlayWindow.setResizable(false);
    void overlayWindow.setSkipTaskbar(true);
  }, [overlayWindow]);

  function handlePresetClick(preset: RewriterPreset) {
    void sendPrompt(preset.prompt);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendPrompt(customPrompt);
    }
    if (e.key === "Escape") abortSession();
  }

  if (phase === "idle") return <div className="rewriter-overlay-root" />;

  return (
    <div className="rewriter-overlay-root">
      <div className="rewriter-pill">
        <div className="rewriter-inner">

          {/* ─── Error ─── */}
          {errorText && (
            <div className="rewriter-error-banner">{errorText}</div>
          )}

          {/* ─── Input ─── */}
          {phase === "input" && (
            <>
              {/* Selected text preview */}
              {selectedText && (
                <div className="rewriter-selected-preview">
                  {selectedText.length > 90
                    ? selectedText.slice(0, 90) + "…"
                    : selectedText}
                </div>
              )}

              {/* Presets */}
              {presets.length > 0 && (
                <div className="rewriter-presets-row">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      className="rewriter-preset-btn"
                      onClick={() => handlePresetClick(preset)}
                      title={preset.prompt}
                    >
                      <span className="flex h-5 w-5 items-center justify-center">
                        <PresetIcon icon={preset.icon} className="h-3.5 w-3.5" />
                      </span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom instruction */}
              <div className="rewriter-input-row">
                <input
                  ref={inputRef}
                  className="rewriter-input"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("rewriter.overlay.placeholder" as any)}
                />
                <button
                  className="rewriter-send-btn"
                  onClick={() => void sendPrompt(customPrompt)}
                  disabled={!customPrompt.trim()}
                  aria-label="Send"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
                <button
                  className="rewriter-close-btn"
                  onClick={abortSession}
                  aria-label="Close"
                >
                  <X />
                </button>
              </div>
            </>
          )}

          {/* ─── Processing ─── */}
          {phase === "processing" && (
            <div className="rewriter-processing">
              <div className="rewriter-spinner" />
              <span>{t("rewriter.overlay.processing" as any)}</span>
              <button className="rewriter-close-btn" onClick={abortSession} aria-label="Cancel">
                <X />
              </button>
            </div>
          )}

          {/* ─── Result ─── */}
          {phase === "result" && (
            <>
              <div className="rewriter-result-text">{resultText}</div>
              <div className="rewriter-actions-row">
                <button className="rewriter-action-btn primary" onClick={() => void insertResult()}>
                  <span className="flex h-4 w-4 items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span>{t("rewriter.overlay.insert" as any)}</span>
                </button>
                <button className="rewriter-action-btn copy" onClick={() => void copyResult()}>
                  <span className="flex h-4 w-4 items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </span>
                  <span>{t("rewriter.overlay.copy" as any)}</span>
                </button>
                <button className="rewriter-action-btn" onClick={rewriteResult}>
                  <span className="flex h-4 w-4 items-center justify-center">
                    <Wand2 className="h-3.5 w-3.5" />
                  </span>
                  <span>{t("rewriter.overlay.rewrite" as any)}</span>
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
