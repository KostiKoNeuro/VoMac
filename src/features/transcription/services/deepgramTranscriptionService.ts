import { translate } from "../../../lib/i18n";
import type { TranscriptionResult } from "../types";

interface DeepgramTranscribeInput {
  audioFile: File;
  apiKey: string;
  baseUrl: string;
  model: string;
  languageHint: string;
  signal?: AbortSignal;
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
  };
  err_code?: string;
  err_msg?: string;
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

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  // Accept both https://api.deepgram.com/v1 and .../v1/listen presets.
  if (url.endsWith("/listen")) {
    url = url.slice(0, -"/listen".length);
  }
  return url;
}

export async function transcribeWithDeepgram({
  audioFile,
  apiKey,
  baseUrl,
  model,
  languageHint,
  signal,
}: DeepgramTranscribeInput): Promise<TranscriptionResult> {
  if (!apiKey.trim()) {
    throw new Error(translate("transcription.error.apiKeyEmpty"));
  }

  if (audioFile.size === 0) {
    throw new Error(translate("transcription.error.audioEmpty"));
  }

  const endpoint = `${normalizeBaseUrl(baseUrl)}/listen`;
  const params = new URLSearchParams();
  params.set("model", model.trim() || "nova-3");
  params.set("smart_format", "true");

  const normalizedLanguageHint = normalizeLanguageHint(languageHint);
  if (normalizedLanguageHint) {
    params.set("language", normalizedLanguageHint);
  } else {
    // nova-3 has no detect_language flag: automatic detection is `language=multi`
    // (en/ru/es/fr/de/hi/pt/ja/it/nl code-switching).
    params.set("language", "multi");
  }

  let response: Response;
  try {
    response = await fetch(`${endpoint}?${params.toString()}`, {
      method: "POST",
      headers: {
        // Deepgram API keys use the Token auth scheme (not Bearer).
        Authorization: `Token ${apiKey}`,
        "Content-Type": audioFile.type || "audio/wav",
      },
      body: audioFile,
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(translate("transcription.error.cancelled"));
    }
    throw new Error(translate("transcription.error.network"));
  }

  const rawText = await response.text();
  let responseBody: DeepgramResponse | null = null;
  try {
    responseBody = JSON.parse(rawText) as DeepgramResponse;
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    const serverMessage =
      responseBody?.err_msg?.trim() ||
      rawText.trim().slice(0, 300) ||
      translate("transcription.error.requestFailed");
    throw new Error(
      `${translate("transcription.error.serverError")} ${response.status}: ${serverMessage}`,
    );
  }

  const text =
    responseBody?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!text) {
    throw new Error(translate("transcription.error.emptyText"));
  }

  return {
    text,
    model,
    provider: "deepgram",
    createdAt: Date.now(),
  };
}
