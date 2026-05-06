import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Notice } from "../../../components/ui/Notice";
import { PillBadge } from "../../../components/ui/PillBadge";
import { useTranscriptionSettings } from "../../transcription/context/TranscriptionSettingsContext";
import { useRecordingSession } from "../lib/useRecordingSession";
import { DictationOverlayPill } from "./DictationOverlayPill";

interface OverlayPreviewDemoProps {
  triggerSignal?: number;
}

export function OverlayPreviewDemo({ triggerSignal }: OverlayPreviewDemoProps) {
  const lastProcessedTriggerRef = useRef<number | null>(null);
  const { settings } = useTranscriptionSettings();
  const {
    overlayState,
    timerLabel,
    successLabel,
    errorTitle,
    errorText,
    insertionNotice,
    lastRecording,
    lastTranscription,
    isListening,
    startRecording,
    stopRecording,
    abortSession,
    resetError,
  } = useRecordingSession({ transcriptionSettings: settings });
  const isProcessing = overlayState === "processing";
  const apiKeyMissing = settings.apiKey.trim().length === 0;

  useEffect(() => {
    if (typeof triggerSignal !== "number") {
      return;
    }
    if (triggerSignal <= 0) {
      return;
    }

    if (lastProcessedTriggerRef.current === triggerSignal) {
      return;
    }

    lastProcessedTriggerRef.current = triggerSignal;

    if (overlayState === "processing") {
      return;
    }

    if (isListening) {
      void stopRecording();
      return;
    }

    void startRecording();
  }, [isListening, overlayState, startRecording, stopRecording, triggerSignal]);

  return (
    <Card className="rounded-[var(--radius-xl)] p-6" tone="soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ui-subtle text-xs uppercase tracking-[0.16em]">Overlay preview</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">
            Floating Dictation Pill
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Live microphone MVP with OpenAI transcription after recording stops.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PillBadge tone="accent">MVP</PillBadge>
          {isListening ? (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Square className="h-3.5 w-3.5 fill-current" />}
              onClick={() => void stopRecording()}
            >
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Mic className="h-4 w-4" />}
              disabled={isProcessing}
              onClick={() => void startRecording()}
            >
              {isProcessing ? "Processing..." : "Start Listening"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <PillBadge tone={isListening ? "success" : "neutral"}>
          {isListening ? "Mic Active" : "Mic Idle"}
        </PillBadge>
        <PillBadge tone="neutral">
          {lastRecording
            ? `Last clip: ${(lastRecording.sizeBytes / 1024).toFixed(1)} KB`
            : "No recording yet"}
        </PillBadge>
        <PillBadge tone={settings.apiKey ? "success" : "error"}>
          {settings.apiKey ? "OpenAI ready" : "Configure API key"}
        </PillBadge>
      </div>

      {apiKeyMissing ? (
        <Notice tone="warning" className="mt-4" title="Transcription setup incomplete">
          Recording still works, but automatic transcription and insertion require OpenAI
          API key in the Transcription section.
        </Notice>
      ) : null}

      <Card
        className="mt-5 rounded-[34px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5"
        tone="glass"
      >
        <div className="relative flex min-h-[90px] items-center justify-center overflow-hidden rounded-[24px] border border-white/8 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(129,140,248,0.08),transparent_70%)] p-4">
          <DictationOverlayPill
            state={overlayState}
            timerLabel={timerLabel}
            errorTitle={errorTitle}
            errorText={errorText ?? undefined}
            successText={successLabel}
            onStart={() => void startRecording()}
            onStop={() => void stopRecording()}
            onAbort={() => void abortSession()}
            onRetry={() => void startRecording()}
            onOpenSettings={resetError}
          />
        </div>
      </Card>

      <AnimatePresence>
        {insertionNotice ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-3"
          >
            <Notice
              tone={errorText ? "warning" : "success"}
              title={errorText ? "Insertion fallback" : "Insertion complete"}
            >
              {insertionNotice}
            </Notice>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {lastRecording ? (
        <Card className="mt-4 rounded-[var(--radius-md)] p-4" tone="soft">
          <p className="ui-subtle text-xs uppercase tracking-[0.15em]">Last recorded audio</p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Saved in memory as `Blob` + `File` for the next transcription step.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PillBadge tone="neutral">{lastRecording.file.name}</PillBadge>
            <PillBadge tone="neutral">{lastRecording.mimeType || "audio/webm"}</PillBadge>
            <PillBadge tone="neutral">
              {(lastRecording.durationMs / 1000).toFixed(1)}s
            </PillBadge>
          </div>
          <audio controls className="mt-3 w-full" src={lastRecording.objectUrl} />
        </Card>
      ) : null}

      {lastTranscription ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <Card className="mt-4 rounded-[var(--radius-md)] p-4" tone="soft">
            <p className="ui-subtle text-xs uppercase tracking-[0.15em]">
              Last transcription result
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-primary)]">
              {lastTranscription.text}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PillBadge tone="neutral">{lastTranscription.provider}</PillBadge>
              <PillBadge tone="neutral">{lastTranscription.model}</PillBadge>
            </div>
          </Card>
        </motion.div>
      ) : (
        <Card className="mt-4 ui-empty-state rounded-[var(--radius-md)] p-4" tone="soft">
          <p className="ui-subtle text-xs uppercase tracking-[0.15em]">
            Transcription output
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Your latest transcription text will appear here after recording stops.
          </p>
        </Card>
      )}
    </Card>
  );
}
