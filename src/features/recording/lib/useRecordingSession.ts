import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranscriptionHistory } from "../../history/context/TranscriptionHistoryContext";
import { insertTextWithFallback } from "../../insertion/services/textInsertionService";
import { transcribeAudio } from "../../transcription/services/transcriptionService";
import type {
  TranscriptionResult,
  TranscriptionSettings,
} from "../../transcription/types";
import { TranslationKey, translate, useTranslation } from "../../../lib/i18n";
import { logRuntimeDiagnostic } from "../../../lib/tauri/diagnostics";
import type { OverlayPillState } from "../overlay/types";
import { assessTranscriptionQuality } from "./qualityGate";
import { SessionFlightController } from "./sessionFlight";
import {
  DeepgramStreamHandle,
  openDeepgramStream,
} from "./deepgramStreamingClient";
import { attachPcmStreamPump } from "./pcmStreamPump";
import { convertToWav } from "../../../lib/audioUtils";

const BAR_COUNT = 10;
const LEVEL_FLOOR = 0.1;
const SUCCESS_STATE_MS = 5000;
const DEFAULT_SUCCESS_STATUS = "inserted";
const DEFAULT_ERROR_TITLE_KEY: TranslationKey = "overlay.error.transcriptionFailedTitle";

type SuccessStatus = "inserted" | "copied";

export interface RecordingArtifact {
  blob: Blob;
  file: File;
  objectUrl: string;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  sizeBytes: number;
}

interface RecordingSessionOptions {
  transcriptionSettings: TranscriptionSettings;
  getLatestTranscriptionSettings?: () => Promise<TranscriptionSettings>;
  alwaysCopyToClipboard?: boolean;
  /** Type finalized chunks straight into the focused field while dictating. */
  liveInsert?: boolean;
}

interface RecordingSessionState {
  overlayState: OverlayPillState;
  levels: number[];
  timerLabel: string;
  successLabel: string;
  liveText: string | null;
  volumeLevel: number;
  errorTitle: string;
  errorText: string | null;
  insertionNotice: string | null;
  lastRecording: RecordingArtifact | null;
  lastTranscription: TranscriptionResult | null;
  isListening: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  abortSession: () => Promise<void>;
  resetError: () => void;
}

function createIdleLevels(): number[] {
  return Array.from({ length: BAR_COUNT }, () => LEVEL_FLOOR);
}

function formatTimer(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createLevelBars(volume: number): number[] {
  return Array.from({ length: BAR_COUNT }, (_, index) => {
    const gradientFactor = 0.55 + index * 0.045;
    const randomJitter = Math.random() * 0.08;
    return Math.min(1, Math.max(LEVEL_FLOOR, volume * gradientFactor + randomJitter));
  });
}

function normalizeMicError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return translate("overlay.error.defaultText");
}

function normalizeTranscriptionError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return translate("overlay.error.defaultText");
}

function assertRecordingApiAvailable(): void {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not available in this WebView.");
  }

  if (typeof window.MediaRecorder === "undefined") {
    throw new Error("Audio recording is not available in this WebView.");
  }

  if (typeof window.AudioContext === "undefined") {
    throw new Error("Audio monitoring is not available in this WebView.");
  }
}

export function useRecordingSession({
  transcriptionSettings,
  getLatestTranscriptionSettings,
  alwaysCopyToClipboard = false,
  liveInsert = false,
}: RecordingSessionOptions): RecordingSessionState {
  const { language } = useTranslation();
  const { addHistoryItem, setItemStatus } = useTranscriptionHistory();
  const [overlayState, setOverlayState] = useState<OverlayPillState>("idle");
  const [levels, setLevels] = useState<number[]>(() => createIdleLevels());
  const [timerMs, setTimerMs] = useState(0);
  const [successStatus, setSuccessStatus] = useState<SuccessStatus>(DEFAULT_SUCCESS_STATUS);
  const [errorTitleKey, setErrorTitleKey] = useState<TranslationKey>(DEFAULT_ERROR_TITLE_KEY);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [insertionNotice, setInsertionNotice] = useState<string | null>(null);
  const [lastRecording, setLastRecording] = useState<RecordingArtifact | null>(null);
  const [lastTranscription, setLastTranscription] =
    useState<TranscriptionResult | null>(null);
  const [liveText, setLiveText] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const overlayStateRef = useRef<OverlayPillState>("idle");
  const lastRecordingRef = useRef<RecordingArtifact | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const overlayResetTimeoutRef = useRef<number | null>(null);
  const requestAbortControllerRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<number | null>(null);
  const isStartingRef = useRef(false);
  const flightControllerRef = useRef(new SessionFlightController());
  const streamClientRef = useRef<DeepgramStreamHandle | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  // Characters already live-typed into the target field during this session.
  const typedCharsRef = useRef(0);

  const setOverlayStateValue = useCallback((nextState: OverlayPillState) => {
    overlayStateRef.current = nextState;
    setOverlayState(nextState);
  }, []);

  const stopMonitoring = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const teardownAudioNodes = useCallback(async () => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") {
      await context.close();
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const disposeRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    chunksRef.current = [];

    if (!recorder) {
      return;
    }

    recorder.ondataavailable = null;
    recorder.onerror = null;

    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // no-op: recorder may already be finalizing
      }
    }
  }, []);

  const resetOverlayTimeout = useCallback(() => {
    if (overlayResetTimeoutRef.current !== null) {
      window.clearTimeout(overlayResetTimeoutRef.current);
      overlayResetTimeoutRef.current = null;
    }
    void invoke("cancel_overlay_hide");
  }, []);

  const cleanupActiveSession = useCallback(async () => {
    streamClientRef.current?.abort();
    streamClientRef.current = null;
    stopMonitoring();
    stopTracks();
    await teardownAudioNodes();
  }, [stopMonitoring, stopTracks, teardownAudioNodes]);

  const resetOverlayVisuals = useCallback(() => {
    setLevels(createIdleLevels());
    setTimerMs(0);
    setLiveText(null);
    setVolumeLevel(0);
  }, []);

  const invalidateCurrentSession = useCallback(() => {
    activeSessionIdRef.current = null;
    isStartingRef.current = false;
    typedCharsRef.current = 0;
    flightControllerRef.current.invalidate();
    requestAbortControllerRef.current = null;
  }, []);

  const resetFeedbackState = useCallback(() => {
    setErrorTitleKey(DEFAULT_ERROR_TITLE_KEY);
    setErrorText(null);
    setInsertionNotice(null);
    setSuccessStatus(DEFAULT_SUCCESS_STATUS);
  }, []);

  const abortSession = useCallback(async () => {
    resetOverlayTimeout();
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;
    disposeRecorder();
    invalidateCurrentSession();
    await cleanupActiveSession();
    resetOverlayVisuals();
    setOverlayStateValue("idle");
    resetFeedbackState();
  }, [
    cleanupActiveSession,
    disposeRecorder,
    invalidateCurrentSession,
    resetFeedbackState,
    resetOverlayTimeout,
    resetOverlayVisuals,
    setOverlayStateValue,
  ]);

  const showErrorState = useCallback(
    async (sessionId: number, titleKey: TranslationKey, message: string) => {
      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      resetOverlayTimeout();
      requestAbortControllerRef.current?.abort();
      requestAbortControllerRef.current = null;
      disposeRecorder();
      await cleanupActiveSession();
      resetOverlayVisuals();
      invalidateCurrentSession();
      setErrorTitleKey(titleKey);
      setErrorText(message);
      setOverlayStateValue("error");
    },
    [
      cleanupActiveSession,
      disposeRecorder,
      invalidateCurrentSession,
      resetOverlayTimeout,
      resetOverlayVisuals,
      setOverlayStateValue,
    ],
  );

  const startMonitoring = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }

    const buffer = new Uint8Array(analyser.fftSize);

    const update = () => {
      analyser.getByteTimeDomainData(buffer);

      let squareSum = 0;
      for (let index = 0; index < buffer.length; index += 1) {
        const normalizedSample = (buffer[index] - 128) / 128;
        squareSum += normalizedSample * normalizedSample;
      }

      const rms = Math.sqrt(squareSum / buffer.length);
      const scaledVolume = Math.min(1, rms * 3.3);
      setLevels(createLevelBars(scaledVolume));
      setVolumeLevel(scaledVolume);

      rafIdRef.current = window.requestAnimationFrame(update);
    };

    rafIdRef.current = window.requestAnimationFrame(update);

    timerIntervalRef.current = window.setInterval(() => {
      setTimerMs(Date.now() - recordingStartedAtRef.current);
    }, 250);
  }, []);

  const finalizeSuccessfulSession = useCallback(
    (status: SuccessStatus) => {
      resetOverlayTimeout();
      activeSessionIdRef.current = null;
      requestAbortControllerRef.current = null;
      setSuccessStatus(status);
      setOverlayStateValue("success");
      void invoke("schedule_overlay_hide", { delayMs: SUCCESS_STATE_MS + 200 });
      overlayResetTimeoutRef.current = window.setTimeout(() => {
        resetOverlayVisuals();
        setInsertionNotice(null);
        setErrorText(null);
        setErrorTitleKey(DEFAULT_ERROR_TITLE_KEY);
        setSuccessStatus(DEFAULT_SUCCESS_STATUS);
        setOverlayStateValue("idle");
      }, SUCCESS_STATE_MS);
    },
    [resetOverlayTimeout, resetOverlayVisuals, setOverlayStateValue],
  );

  const prepareForNextSession = useCallback(async () => {
    resetOverlayTimeout();
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;
    disposeRecorder();
    invalidateCurrentSession();
    await cleanupActiveSession();
    resetOverlayVisuals();
    resetFeedbackState();
  }, [
    cleanupActiveSession,
    disposeRecorder,
    invalidateCurrentSession,
    resetFeedbackState,
    resetOverlayTimeout,
    resetOverlayVisuals,
  ]);

  const attachDeepgramStreaming = useCallback(
    async (
      sessionId: number,
      audioContext: AudioContext,
      source: MediaStreamAudioSourceNode,
    ) => {
      try {
        const client = openDeepgramStream({
          apiKey: transcriptionSettings.apiKey,
          model: transcriptionSettings.model,
          languageHint: transcriptionSettings.languageHint,
        });
        streamClientRef.current = client;

        client.onTranscript((text) => {
          if (flightControllerRef.current.isCurrent(sessionId)) {
            setLiveText(text);
          }
        });

        // Live typing: every finalized chunk goes straight into the focused
        // field via synthetic Unicode keystrokes (clipboard stays untouched).
        if (liveInsert) {
          client.onFinalTranscript((chunk) => {
            if (!flightControllerRef.current.isCurrent(sessionId)) {
              return;
            }

            const payload = `${chunk} `;
            typedCharsRef.current += payload.length;
            void invoke("insert_text_live", { text: payload }).catch((error) => {
              void logRuntimeDiagnostic("insertion", "live-typing-error", {
                sessionId,
                message: String(error),
              });
            });
          });
        }

        const worklet = await attachPcmStreamPump(audioContext, source, (chunk) => {
          const samples = new Int16Array(chunk.length);
          for (let index = 0; index < chunk.length; index += 1) {
            const sample = Math.max(-1, Math.min(1, chunk[index]));
            samples[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
          }
          client.sendAudio(samples);
        });
        workletNodeRef.current = worklet;
        void logRuntimeDiagnostic("recording", "deepgram-stream-attached", {
          sessionId,
        });
      } catch (error) {
        // Streaming is best-effort: the recorded blob still goes through the
        // regular file-based flow when the stream cannot be attached.
        streamClientRef.current = null;
        void logRuntimeDiagnostic("recording", "deepgram-stream-failed", {
          sessionId,
          message: normalizeMicError(error),
        });
      }
    },
    [liveInsert, transcriptionSettings],
  );

  const startRecording = useCallback(async () => {
    if (
      isStartingRef.current ||
      overlayStateRef.current === "listening" ||
      overlayStateRef.current === "processing"
    ) {
      void logRuntimeDiagnostic("recording", "start-ignored", {
        isStarting: isStartingRef.current,
        overlayState: overlayStateRef.current,
      });
      return;
    }

    isStartingRef.current = true;
    await prepareForNextSession();

    const sessionId = flightControllerRef.current.createSession();
    activeSessionIdRef.current = sessionId;
    const startRequestedAt = Date.now();
    void logRuntimeDiagnostic("recording", "start-requested", {
      sessionId,
      requestedAtMs: startRequestedAt,
    });

    try {
      assertRecordingApiAvailable();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!flightControllerRef.current.isCurrent(sessionId)) {
        isStartingRef.current = false;
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const streamReadyAt = Date.now();

      // 16 kHz matches the streaming wire format (Deepgram linear16) so the
      // worklet pump can send raw mic samples without resampling.
      const audioContext = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      analyserRef.current = analyser;

      source.connect(analyser);

      if (transcriptionSettings.provider === "deepgram") {
        void attachDeepgramStreaming(sessionId, audioContext, source);
      }

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (
          flightControllerRef.current.isCurrent(sessionId) &&
          event.data.size > 0
        ) {
          chunksRef.current.push(event.data);
        }
      };

      recordingStartedAtRef.current = Date.now();
      recorder.start(220);
      isStartingRef.current = false;
      void logRuntimeDiagnostic("recording", "started", {
        sessionId,
        requestedAtMs: startRequestedAt,
        streamReadyAtMs: streamReadyAt,
        startedAtMs: recordingStartedAtRef.current,
        startupDelayMs: recordingStartedAtRef.current - startRequestedAt,
      });
      setOverlayStateValue("listening");
      startMonitoring();
    } catch (error) {
      isStartingRef.current = false;
      void logRuntimeDiagnostic("recording", "start-failed", {
        sessionId,
        requestedAtMs: startRequestedAt,
        failedAtMs: Date.now(),
        message: normalizeMicError(error),
      });
      await showErrorState(sessionId, "overlay.error.microphoneTitle", normalizeMicError(error));
    }
  }, [
    attachDeepgramStreaming,
    prepareForNextSession,
    setOverlayStateValue,
    showErrorState,
    startMonitoring,
    transcriptionSettings,
  ]);

  const stopRecording = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;
    if (overlayStateRef.current !== "listening" || sessionId === null) {
      return;
    }

    if (!flightControllerRef.current.beginProcessing(sessionId)) {
      return;
    }

    // Detach the stream client before any cleanup path can abort it.
    const streamClient = streamClientRef.current;
    streamClientRef.current = null;

    resetOverlayTimeout();
    stopMonitoring();
    setLevels(createIdleLevels());
    setOverlayStateValue("processing");
    const stopRequestedAt = Date.now();
    void logRuntimeDiagnostic("recording", "stop-requested", {
      sessionId,
      stopRequestedAtMs: stopRequestedAt,
      startedAtMs: recordingStartedAtRef.current,
    });

    try {
      const recorder = recorderRef.current;
      const startedAt = recordingStartedAtRef.current;
      if (!recorder) {
        throw new Error(translate("overlay.error.defaultText"));
      }

      let blob = await new Promise<Blob>((resolve, reject) => {
        const handleStop = () => {
          recorder.removeEventListener("error", handleError);
          const mimeType = recorder.mimeType || "audio/webm";
          resolve(new Blob(chunksRef.current, { type: mimeType }));
        };

        const handleError = () => {
          recorder.removeEventListener("stop", handleStop);
          reject(new Error(translate("overlay.error.defaultText")));
        };

        recorder.addEventListener("stop", handleStop, { once: true });
        recorder.addEventListener("error", handleError, { once: true });
        recorder.stop();
      });

      recorderRef.current = null;
      const stoppedAt = Date.now();
      void logRuntimeDiagnostic("recording", "stopped", {
        sessionId,
        startedAtMs: startedAt,
        stopRequestedAtMs: stopRequestedAt,
        stoppedAtMs: stoppedAt,
        stopFinalizeDelayMs: stoppedAt - stopRequestedAt,
        blobSizeBytes: blob.size,
      });

      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      const createdAt = Date.now();
      const mimeType = blob.type || "audio/webm";
      const fileExtension = mimeType.includes("wav") ? "wav" : mimeType.includes("ogg") ? "ogg" : "webm";
      const file = new File(
        [blob],
        `vo-recording-${new Date(createdAt).toISOString().replace(/[:.]/g, "-")}.${fileExtension}`,
        { type: mimeType },
      );

      const nextRecording: RecordingArtifact = {
        blob,
        file,
        objectUrl: window.URL.createObjectURL(blob),
        mimeType,
        durationMs: Math.max(0, createdAt - startedAt),
        createdAt,
        sizeBytes: blob.size,
      };

      setLastRecording((currentValue) => {
        if (currentValue) {
          window.URL.revokeObjectURL(currentValue.objectUrl);
        }

        lastRecordingRef.current = nextRecording;
        return nextRecording;
      });

      await cleanupActiveSession();

      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      const effectiveTranscriptionSettings = getLatestTranscriptionSettings
        ? await getLatestTranscriptionSettings()
        : transcriptionSettings;

      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      const abortController = new AbortController();
      requestAbortControllerRef.current = abortController;

      // Prefer live-streamed finals; the recorded blob stays as a fallback so
      // a failed or empty stream degrades to the regular REST flow instead of
      // losing the dictation.
      let transcription: TranscriptionResult | null = null;
      let liveTypedChars = 0;
      if (streamClient && streamClient.isUsable()) {
        const streamedText = await streamClient.finish();
        liveTypedChars = liveInsert ? typedCharsRef.current : 0;
        if (streamedText || liveTypedChars > 0) {
          void logRuntimeDiagnostic("recording", "stream-finalized", {
            sessionId,
            chars: streamedText.length,
            liveTypedChars,
          });
          transcription = {
            text: streamedText,
            model: effectiveTranscriptionSettings.model,
            provider: "deepgram",
            createdAt: Date.now(),
          };
        }
      } else {
        streamClient?.abort();
      }

      if (!transcription) {
        try {
          blob = await convertToWav(blob);
        } catch (error) {
          console.error("Failed to convert webm to wav:", error);
        }

        const fallbackMimeType = blob.type || "audio/wav";
        const fallbackFile = new File(
          [blob],
          `vo-recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${
            fallbackMimeType.includes("wav")
              ? "wav"
              : fallbackMimeType.includes("ogg")
                ? "ogg"
                : "webm"
          }`,
          { type: fallbackMimeType },
        );

        transcription = await transcribeAudio({
          audioFile: fallbackFile,
          settings: effectiveTranscriptionSettings,
          signal: abortController.signal,
        });
      }

      requestAbortControllerRef.current = null;
      flightControllerRef.current.endProcessing(sessionId);

      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      setLastTranscription(transcription);

      if (alwaysCopyToClipboard && navigator.clipboard) {
        void navigator.clipboard.writeText(transcription.text).catch(() => {
          // Clipboard copy is best-effort, don't block the flow
        });
      }

      const historyItem = addHistoryItem({
        text: transcription.text,
        provider: transcription.provider,
        model: transcription.model,
        createdAt: transcription.createdAt,
      });

      const qualityResult = assessTranscriptionQuality({
        text: transcription.text,
        durationMs: nextRecording.durationMs,
      });

      if (!qualityResult.allowed) {
        setItemStatus(historyItem.id, "blocked", qualityResult.reason);
        if (liveTypedChars > 0) {
          // Undo the already-typed text so rejected dictations don't linger.
          void invoke("delete_last_chars", { count: liveTypedChars });
        }
        await showErrorState(
          sessionId,
          "overlay.error.suspiciousBlockedTitle",
          qualityResult.reason ?? translate("quality.corrupted"),
        );
        return;
      }

      if (!flightControllerRef.current.markInserted(sessionId)) {
        return;
      }

      if (liveTypedChars > 0) {
        // The text was typed into the field while dictating; nothing left to insert.
        setItemStatus(historyItem.id, "inserted");
        finalizeSuccessfulSession("inserted");
        return;
      }

      const insertionResult = await insertTextWithFallback(transcription.text);
      setInsertionNotice(insertionResult.message);
      void logRuntimeDiagnostic("insertion", "result", {
        sessionId,
        status: insertionResult.status,
        strategy: insertionResult.strategy,
      });

      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      if (insertionResult.status === "inserted") {
        setItemStatus(historyItem.id, "inserted");
        finalizeSuccessfulSession("inserted");
        return;
      }

      if (insertionResult.status === "copied") {
        setItemStatus(historyItem.id, "copied");
        finalizeSuccessfulSession("copied");
        return;
      }

      setItemStatus(historyItem.id, "failed", insertionResult.message);
      await showErrorState(sessionId, "overlay.error.insertionFailedTitle", insertionResult.message);
    } catch (error) {
      requestAbortControllerRef.current = null;
      flightControllerRef.current.endProcessing(sessionId);

      if (!flightControllerRef.current.isCurrent(sessionId)) {
        return;
      }

      await showErrorState(
        sessionId,
        "overlay.error.transcriptionFailedTitle",
        normalizeTranscriptionError(error),
      );
    }
  }, [
    addHistoryItem,
    cleanupActiveSession,
    finalizeSuccessfulSession,
    getLatestTranscriptionSettings,
    liveInsert,
    resetOverlayTimeout,
    setItemStatus,
    stopMonitoring,
    showErrorState,
    transcriptionSettings,
  ]);

  const resetError = useCallback(() => {
    resetOverlayTimeout();
    resetFeedbackState();
    resetOverlayVisuals();
    if (overlayStateRef.current === "error") {
      setOverlayStateValue("idle");
    }
  }, [resetFeedbackState, resetOverlayTimeout, resetOverlayVisuals, setOverlayStateValue]);

  useEffect(() => {
    return () => {
      void abortSession();
      if (lastRecordingRef.current?.objectUrl) {
        window.URL.revokeObjectURL(lastRecordingRef.current.objectUrl);
      }
    };
  }, [abortSession]);

  const timerLabel = useMemo(() => formatTimer(timerMs), [timerMs]);
  const successLabel = useMemo(() => {
    return successStatus === "copied"
      ? translate("overlay.success.copied")
      : translate("overlay.success.inserted");
  }, [language, successStatus]);
  const errorTitle = useMemo(() => translate(errorTitleKey), [errorTitleKey, language]);

  return {
    overlayState,
    levels,
    timerLabel,
    successLabel,
    liveText,
    volumeLevel,
    errorTitle,
    errorText,
    insertionNotice,
    lastRecording,
    lastTranscription,
    isListening: overlayState === "listening",
    startRecording,
    stopRecording,
    abortSession,
    resetError,
  };
}
