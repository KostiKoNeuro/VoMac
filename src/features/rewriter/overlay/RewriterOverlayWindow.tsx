import { useEffect, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  APP_EVENT_REWRITER_TRIGGERED,
  APP_EVENT_REWRITER_ABORT,
} from "../../../lib/tauri/events";
import { useTranslation } from "../../../lib/i18n";
import { loadSharedRewriterSettings } from "../../../lib/sharedState";
import { useRewriterSession } from "../lib/useRewriterSession";
import type { RewriterPreset } from "../types";

interface RewriterTriggeredPayload {
  sequence: number;
  selectedText: string;
}

export function RewriterOverlayWindow() {
  const { t } = useTranslation();
  const overlayWindow = useMemo(() => getCurrentWindow(), []);

  const {
    phase,
    selectedText,
    customPrompt,
    setCustomPrompt,
    resultText,
    presets,
    errorText,
    startSession,
    abortSession,
    sendPrompt,
    insertResult,
    rewriteResult,
    copyResult,
  } = useRewriterSession({
    getLatestRewriterSettings: loadSharedRewriterSettings,
  });

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when moving to input phase
  useEffect(() => {
    if (phase === "input") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  // Setup listeners and mark ready
  useEffect(() => {
    let cancelled = false;
    let unlistenTriggered: (() => void) | null = null;
    let unlistenAbort: (() => void) | null = null;

    async function setupListeners() {
      const cleanups = await Promise.all([
        overlayWindow.listen<RewriterTriggeredPayload>(
          APP_EVENT_REWRITER_TRIGGERED,
          (event) => {
            void startSession(event.payload.selectedText);
          },
        ),
        overlayWindow.listen(APP_EVENT_REWRITER_ABORT, () => {
          abortSession();
        }),
      ]);

      if (cancelled) {
        cleanups.forEach((cleanup: () => void) => cleanup());
      } else {
        unlistenTriggered = cleanups[0];
        unlistenAbort = cleanups[1];
        await invoke("mark_rewriter_ready");
      }
    }

    void setupListeners();

    return () => {
      cancelled = true;
      unlistenTriggered?.();
      unlistenAbort?.();
    };
  }, [overlayWindow, startSession, abortSession]);

  // Hide when idle
  useEffect(() => {
    if (phase === "idle") {
      void invoke("schedule_rewriter_hide", { delayMs: 300 });
    } else {
      void invoke("cancel_rewriter_hide");
      void overlayWindow.show();
    }
  }, [phase, overlayWindow]);

  // Window setup
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
    if (e.key === "Escape") {
      abortSession();
    }
  }

  if (phase === "idle") {
    return <div className="rewriter-overlay-root" />;
  }

  return (
    <div className="rewriter-overlay-root">
      <div className="rewriter-pill">
        {/* ─── Error banner ─── */}
        {errorText && (
          <div className="rewriter-error-banner">
            {errorText}
          </div>
        )}

        {/* ─── Input phase ─── */}
        {phase === "input" && (
          <>
            {selectedText && (
              <div className="rewriter-selected-preview">
                {selectedText.length > 80
                  ? selectedText.slice(0, 80) + "…"
                  : selectedText}
              </div>
            )}

            {presets.length > 0 && (
              <div className="rewriter-presets-row">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    className="rewriter-preset-btn"
                    onClick={() => handlePresetClick(preset)}
                    title={preset.prompt}
                  >
                    {preset.icon && <span>{preset.icon}</span>}
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="rewriter-input-row">
              <input
                ref={inputRef}
                className="rewriter-input"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("rewriter.overlay.placeholder" as any)}
                autoFocus
              />
              <button
                className="rewriter-send-btn"
                onClick={() => void sendPrompt(customPrompt)}
                disabled={!customPrompt.trim()}
              >
                {t("rewriter.overlay.send" as any)}
              </button>
              <button
                className="rewriter-close-btn"
                onClick={abortSession}
                title="Esc"
              >
                ✕
              </button>
            </div>
          </>
        )}

        {/* ─── Processing phase ─── */}
        {phase === "processing" && (
          <div className="rewriter-processing">
            <div className="rewriter-spinner" />
            <span>{t("rewriter.overlay.processing" as any)}</span>
            <button
              className="rewriter-close-btn"
              onClick={abortSession}
              title={t("rewriter.overlay.cancel" as any)}
            >
              ✕
            </button>
          </div>
        )}

        {/* ─── Result phase ─── */}
        {phase === "result" && (
          <>
            <div className="rewriter-result-text">{resultText}</div>
            <div className="rewriter-actions-row">
              <button className="rewriter-action-btn primary" onClick={() => void insertResult()}>
                {t("rewriter.overlay.insert" as any)}
              </button>
              <button className="rewriter-action-btn copy" onClick={() => void copyResult()}>
                {t("rewriter.overlay.copy" as any)}
              </button>
              <button className="rewriter-action-btn" onClick={rewriteResult}>
                {t("rewriter.overlay.rewrite" as any)}
              </button>
              <button className="rewriter-action-btn cancel" onClick={abortSession}>
                {t("rewriter.overlay.cancel" as any)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

