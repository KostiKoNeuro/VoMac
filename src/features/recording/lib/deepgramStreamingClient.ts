import { translate } from "../../../lib/i18n";

export interface DeepgramStreamOptions {
  apiKey: string;
  model: string;
  languageHint: string;
}

export interface DeepgramStreamHandle {
  /** Sends a chunk of mono 16 kHz PCM16 samples. */
  sendAudio(pcm: Int16Array): void;
  /** Live transcript updates: finals joined plus the current interim. */
  onTranscript(callback: (liveText: string) => void): void;
  /** True while the socket is open and usable for dictation. */
  isUsable(): boolean;
  /** True once at least one final result has arrived. */
  hasFinals(): boolean;
  /**
   * Gracefully closes the stream and resolves with the accumulated final
   * transcript. Resolves with an empty string when nothing was recognized.
   */
  finish(): Promise<string>;
  /** Closes the socket immediately without waiting. */
  abort(): void;
}

interface DeepgramStreamMessage {
  type?: string;
  is_final?: boolean;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
  };
}

function normalizeLanguageHint(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const lowerCased = normalized.toLowerCase();
  if (lowerCased === "auto" || lowerCased === "auto detect" || lowerCased === "auto-detect") {
    return null;
  }

  return normalized;
}

/**
 * Opens a streaming WebSocket to Deepgram's /listen endpoint.
 *
 * The browser API cannot set an Authorization header on WebSockets, so the key
 * is passed through the Sec-WebSocket-Protocol trick used by Deepgram's own
 * browser SDK: protocols ["token", <apiKey>].
 */
export function openDeepgramStream({
  apiKey,
  model,
  languageHint,
}: DeepgramStreamOptions): DeepgramStreamHandle {
  const params = new URLSearchParams();
  params.set("model", model.trim() || "nova-3");
  params.set("smart_format", "true");
  params.set("interim_results", "true");
  params.set("utterance_end_ms", "1000");
  params.set("encoding", "linear16");
  params.set("sample_rate", "16000");
  params.set("channels", "1");

  const normalizedLanguageHint = normalizeLanguageHint(languageHint);
  params.set("language", normalizedLanguageHint ?? "multi");

  let socket: WebSocket | null = null;
  try {
    socket = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params.toString()}`,
      ["token", apiKey],
    );
  } catch {
    socket = null;
  }

  const finals: string[] = [];
  let latestInterim = "";
  let transcriptCallback: ((liveText: string) => void) | null = null;

  const emitLiveText = () => {
    const joined = [...finals, latestInterim].filter(Boolean).join(" ").trim();
    if (transcriptCallback && joined) {
      transcriptCallback(joined);
    }
  };

  if (socket) {
    socket.onmessage = (event) => {
      let data: DeepgramStreamMessage;
      try {
        data = JSON.parse(event.data as string) as DeepgramStreamMessage;
      } catch {
        return;
      }

      if (data.type !== "Results") {
        return;
      }

      const transcript = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        return;
      }

      if (data.is_final) {
        finals.push(transcript);
        latestInterim = "";
      } else {
        latestInterim = transcript;
      }
      emitLiveText();
    };
    // Connection failures surface via onclose/onerror; isUsable() reflects them.
    socket.onerror = () => {};
    socket.onclose = () => {};
  }

  return {
    sendAudio(pcm) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Copy into a plain ArrayBuffer: Int16Array.buffer is exactly what the
        // wire needs (linear16 little-endian mono).
        socket.send(pcm.buffer.slice(0));
      }
    },

    onTranscript(callback) {
      transcriptCallback = callback;
    },

    isUsable() {
      return (
        socket !== null &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      );
    },

    hasFinals() {
      return finals.length > 0;
    },

    finish() {
      return new Promise<string>((resolve) => {
        const target = socket;
        if (!target || target.readyState !== WebSocket.OPEN) {
          resolve(finals.join(" ").trim());
          return;
        }

        let settled = false;
        const settle = () => {
          if (!settled) {
            settled = true;
            clearTimeout(graceTimer);
            resolve(finals.join(" ").trim());
          }
        };

        // Give the server a short grace period to flush trailing finals after
        // CloseStream; resolve regardless so dictation never hangs.
        const graceTimer = setTimeout(settle, 900);

        target.addEventListener("close", settle, { once: true });
        try {
          target.send(JSON.stringify({ type: "Close" }));
        } catch {
          settle();
        }
      }).then((text) => text.trim());
    },

    abort() {
      try {
        socket?.close();
      } catch {
        // no-op: socket may already be closed
      }
    },
  };
}

export function describeStreamError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return translate("overlay.error.defaultText");
}
