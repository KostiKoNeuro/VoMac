import { transcribeWithOpenAi } from "./openaiTranscriptionService";
import type { TranscribeAudioInput, TranscriptionResult } from "../types";

export async function transcribeAudio({
  audioFile,
  settings,
  signal,
}: TranscribeAudioInput): Promise<TranscriptionResult> {
  // All providers use OpenAI-compatible API format
  return transcribeWithOpenAi({
    audioFile,
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    languageHint: settings.languageHint,
    signal,
  });
}