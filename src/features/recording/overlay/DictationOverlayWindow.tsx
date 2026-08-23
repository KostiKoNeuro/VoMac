import { useEffect, useRef, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { useTranscriptionSettings } from "../../transcription/context/TranscriptionSettingsContext";
import {
  loadSharedTranscriptionSettings,
  loadSharedGeneralSettings,
  listenForSharedGeneralSettingsSync,
} from "../../../lib/sharedState";
import {
  APP_EVENT_DICTATION_ABORT,
  APP_EVENT_DICTATION_TRIGGERED,
} from "../../../lib/tauri/events";
import { markWindowReady } from "../../../lib/tauri/window";
import { useRecordingSession } from "../lib/useRecordingSession";
import { DictationOverlayPill } from "./DictationOverlayPill";

interface DictationTriggeredPayload {
  sequence: number;
  anchor: {
    x: number;
    y: number;
    mode: "caret" | "focus" | "window" | "monitor-center";
  };
  monitor: {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleFactor: number;
  };
}

// The pill expands while listening (orb + live transcript) and collapses back
// otherwise. Sizes are logical pixels.
const COMPACT_SIZE = { width: 304, height: 92 };
const EXPANDED_SIZE = { width: 340, height: 150 };

/**
 * Resizes the overlay window while keeping its bottom edge anchored: growth
 * extends upward, so the pill never sinks below its original bottom line.
 */
async function resizeKeepingBottomAnchor(
  window: ReturnType<typeof getCurrentWindow>,
  width: number,
  height: number,
): Promise<void> {
  try {
    const position = await window.outerPosition();
    const scaleFactor = await window.scaleFactor();
    const currentSize = await window.outerSize();
    const targetHeight = Math.round(height * scaleFactor);
    const bottomY = position.y + currentSize.height;

    await window.setSize(new LogicalSize(width, height));
    await window.setPosition(
      new PhysicalPosition(position.x, bottomY - targetHeight),
    );
  } catch {
    // Best-effort: if window APIs are unavailable, keep the current geometry.
  }
}

export function DictationOverlayWindow() {
  const overlayWindow = useMemo(() => getCurrentWindow(), []);
  const { settings } = useTranscriptionSettings();
  const [alwaysCopyToClipboard, setAlwaysCopyToClipboard] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadSharedGeneralSettings().then((gs) => {
      if (mounted) setAlwaysCopyToClipboard(gs.alwaysCopyToClipboard);
    });
    void listenForSharedGeneralSettingsSync(async () => {
      if (!mounted) return;
      const gs = await loadSharedGeneralSettings();
      if (mounted) setAlwaysCopyToClipboard(gs.alwaysCopyToClipboard);
    });
    return () => { mounted = false; };
  }, []);

  const {
    overlayState,
    timerLabel,
    successLabel,
    liveText,
    volumeLevel,
    errorTitle,
    errorText,
    startRecording,
    stopRecording,
    abortSession,
    resetError,
  } = useRecordingSession({
    transcriptionSettings: settings,
    getLatestTranscriptionSettings: loadSharedTranscriptionSettings,
    alwaysCopyToClipboard,
  });

  const overlayStateRef = useRef(overlayState);
  const startRecordingRef = useRef(startRecording);
  const stopRecordingRef = useRef(stopRecording);
  const abortSessionRef = useRef(abortSession);
  const resetErrorRef = useRef(resetError);

  overlayStateRef.current = overlayState;
  startRecordingRef.current = startRecording;
  stopRecordingRef.current = stopRecording;
  abortSessionRef.current = abortSession;
  resetErrorRef.current = resetError;

  useEffect(() => {
    void overlayWindow.setAlwaysOnTop(true);
    void overlayWindow.setResizable(false);
    void overlayWindow.setFocusable(false);
    void overlayWindow.setIgnoreCursorEvents(false);
    void overlayWindow.setSkipTaskbar(true);
  }, [overlayWindow]);

  useEffect(() => {
    if (overlayState === "idle") {
      import("@tauri-apps/api/core").then(({ invoke }) => {
        void invoke("schedule_overlay_hide", { delayMs: 500 });
      });
      return;
    }

    import("@tauri-apps/api/core").then(({ invoke }) => {
      void invoke("cancel_overlay_hide");
    });
    void overlayWindow.show();
  }, [overlayState, overlayWindow]);

  // Expand while listening (orb layout), collapse back otherwise.
  useEffect(() => {
    const size = overlayState === "listening" ? EXPANDED_SIZE : COMPACT_SIZE;
    void resizeKeepingBottomAnchor(overlayWindow, size.width, size.height);
  }, [overlayState, overlayWindow]);

  useEffect(() => {
    let unlistenTriggered: (() => void) | null = null;
    let unlistenAbort: (() => void) | null = null;
    let cancelled = false;

    async function setupListeners() {
      const cleanups = await Promise.all([
        overlayWindow.listen<DictationTriggeredPayload>(APP_EVENT_DICTATION_TRIGGERED, async () => {
          const currentState = overlayStateRef.current;
          if (currentState === "processing") {
            await abortSessionRef.current();
            return;
          }

          if (currentState === "listening") {
            await stopRecordingRef.current();
            return;
          }

          resetErrorRef.current();
          await startRecordingRef.current();
        }),
        overlayWindow.listen(APP_EVENT_DICTATION_ABORT, async () => {
          await abortSessionRef.current();
        }),
      ]);

      if (cancelled) {
        cleanups.forEach((cleanup: () => void) => cleanup());
      } else {
        unlistenTriggered = cleanups[0];
        unlistenAbort = cleanups[1];
        await markWindowReady("overlay");
      }
    }

    void setupListeners();

    return () => {
      cancelled = true;
      unlistenTriggered?.();
      unlistenAbort?.();
    };
  }, [overlayWindow]);

  return (
    <div className="grid h-screen place-items-center bg-transparent px-1 py-1">
      <DictationOverlayPill
        state={overlayState}
        interactive
        timerLabel={timerLabel}
        liveText={liveText ?? undefined}
        volume={volumeLevel}
        errorTitle={errorTitle}
        errorText={errorText ?? undefined}
        successText={successLabel}
        onStart={() => void startRecording()}
        onStop={() => void stopRecording()}
        onAbort={() => void abortSession()}
      />
    </div>
  );
}
