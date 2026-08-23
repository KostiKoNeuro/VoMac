import { transcribeWithDeepgram } from "./deepgramTranscriptionService";
import { transcribeWithOpenAi } from "./openaiTranscriptionService";
import type { TranscribeAudioInput, TranscriptionResult } from "../types";

export async function transcribeAudio({
  audioFile,
  settings,
  signal,
}: TranscribeAudioInput): Promise<TranscriptionResult> {
  // Deepgram uses its own REST API shape; all other providers are OpenAI-compatible.
  if (settings.provider === "deepgram") {
    return transcribeWithDeepgram({
      audioFile,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      languageHint: settings.languageHint,
      signal,
    });
  }

  return transcribeWithOpenAi({
    audioFile,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    languageHint: settings.languageHint,
    signal,
  });
}
