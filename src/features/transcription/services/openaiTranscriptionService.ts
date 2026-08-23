import { translate } from "../../../lib/i18n";
import type { TranscriptionResult } from "../types";

interface OpenAiTranscribeInput {
  audioFile: File;
  apiKey: string;
  baseUrl: string;
  model: string;
  languageHint: string;
  signal?: AbortSignal;
}

interface OpenAiResponse {
  text?: string;
  error?: {
    message?: string;
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

function createSafeTranscriptionPrompt(languageHint: string | null): string {
  const languageClause = languageHint
    ? `The expected spoken language is ${languageHint}. `
    : "";

  return (
    `${languageClause}Transcribe only the words actually spoken in the audio. ` +
    "Do not answer the speaker, do not translate, do not summarize, and do not invent text. " +
    "If the audio is mostly silence, noise, or unintelligible speech, return an empty transcription."
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim();
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  return url;
}

export async function transcribeWithOpenAi({
  audioFile,
  apiKey,
  baseUrl,
  model,
  languageHint,
  signal,
}: OpenAiTranscribeInput): Promise<TranscriptionResult> {
  if (!apiKey.trim()) {
    throw new Error(translate("transcription.error.apiKeyEmpty"));
  }

  if (audioFile.size === 0) {
    throw new Error(translate("transcription.error.audioEmpty"));
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl || "https://api.openai.com/v1");
  const endpoint = `${normalizedBaseUrl}/audio/transcriptions`;
  console.log("Transcribing with endpoint:", endpoint);

  const formData = new FormData();
  const normalizedLanguageHint = normalizeLanguageHint(languageHint);
  formData.append("file", audioFile);
  formData.append("model", model);
  formData.append("prompt", createSafeTranscriptionPrompt(normalizedLanguageHint));
  if (normalizedLanguageHint) {
    formData.append("language", normalizedLanguageHint);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal,
    });
  } catch (error) {
    console.error("fetch error:", error);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(translate("transcription.error.cancelled"));
    }
    throw new Error(translate("transcription.error.network"));
  }

  let responseBody: OpenAiResponse | null = null;
  const rawText = await response.text();
  console.log("Response status:", response.status, "Raw response:", rawText);
  try {
    responseBody = JSON.parse(rawText) as OpenAiResponse;
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
    const serverMessage =
      responseBody?.error?.message?.trim() || translate("transcription.error.requestFailed");
    console.error("Transcription failed. Status", response.status, "Message:", serverMessage);
    throw new Error(
      `${translate("transcription.error.serverError")} ${response.status}: ${serverMessage}`,
    );
  }

  const text = responseBody?.text?.trim();
  if (!text) {
    throw new Error(translate("transcription.error.emptyText"));
  }

  return {
    text,
    model,
    provider: "openai",
    createdAt: Date.now(),
  };
}