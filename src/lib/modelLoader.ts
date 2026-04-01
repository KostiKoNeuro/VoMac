/**
 * Fetches available models from an OpenAI-compatible /models endpoint.
 * Filters results based on purpose (stt = speech-to-text, chat = chat completions).
 */

export interface ModelInfo {
  id: string;
  owned_by?: string;
}

interface ModelsResponse {
  data?: ModelInfo[];
  error?: { message?: string };
}

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

const STT_KEYWORDS = [
  "whisper",
  "transcrib",
  "audio",
  "speech",
  "stt",
];

const CHAT_EXCLUDE_KEYWORDS = [
  "whisper",
  "tts",
  "dall-e",
  "davinci",
  "babbage",
  "embedding",
  "moderation",
  "realtime",
];

export type ModelPurpose = "stt" | "chat";

function matchesPurpose(modelId: string, purpose: ModelPurpose): boolean {
  const lower = modelId.toLowerCase();

  if (purpose === "stt") {
    return STT_KEYWORDS.some((kw) => lower.includes(kw));
  }

  // For chat, exclude known non-chat models
  return !CHAT_EXCLUDE_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchAvailableModels(
  baseUrl: string,
  apiKey: string,
  purpose: ModelPurpose,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!baseUrl.trim()) {
    return [];
  }

  const endpoint = `${normalizeBaseUrl(baseUrl)}/models`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized: check your API key.");
    }
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  const data = (await response.json()) as ModelsResponse;

  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  // Deduplicate by lowercase to avoid whisper-1 / Whisper-1 style duplicates
  const seen = new Map<string, string>();
  for (const m of data.data) {
    const key = m.id.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, m.id);
    }
  }

  return Array.from(seen.values())
    .filter((id) => matchesPurpose(id, purpose))
    .sort((a, b) => a.localeCompare(b));
}
