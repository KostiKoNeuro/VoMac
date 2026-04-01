import {
  defaultTranscriptionSettings,
  providerPresets,
} from "./transcriptionSettings";
import type { TranscriptionSettings, CustomProviderConfig } from "../types";

const STORAGE_KEY = "vo.transcription.settings";

function isKnownProvider(
  value: string,
  customProviders: CustomProviderConfig[],
): boolean {
  if (providerPresets.some((option) => option.value === value)) {
    return true;
  }
  if (value.startsWith("custom_")) {
    const customId = value.slice("custom_".length);
    return customProviders.some((cp) => cp.id === customId);
  }
  return false;
}

function isValidCustomProvider(value: unknown): value is CustomProviderConfig {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<CustomProviderConfig>;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    typeof c.baseUrl === "string" &&
    typeof c.apiKey === "string"
  );
}

export function loadTranscriptionSettings(): TranscriptionSettings {
  if (typeof window === "undefined") {
    return defaultTranscriptionSettings;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return defaultTranscriptionSettings;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<TranscriptionSettings>;

    const customProviders = Array.isArray(parsed.customProviders)
      ? parsed.customProviders.filter(isValidCustomProvider)
      : [];

    const providerCandidate =
      typeof parsed.provider === "string" ? parsed.provider : "";
    const provider = isKnownProvider(providerCandidate, customProviders)
      ? providerCandidate
      : defaultTranscriptionSettings.provider;
    const model =
      typeof parsed.model === "string" && parsed.model.trim().length > 0
        ? parsed.model
        : defaultTranscriptionSettings.model;
    const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
    const baseUrl =
      typeof parsed.baseUrl === "string" && parsed.baseUrl.trim().length > 0
        ? parsed.baseUrl
        : defaultTranscriptionSettings.baseUrl;
    const languageHint =
      typeof parsed.languageHint === "string" ? parsed.languageHint : "";

    return { provider, model, apiKey, baseUrl, languageHint, customProviders };
  } catch {
    return defaultTranscriptionSettings;
  }
}

export function saveTranscriptionSettings(settings: TranscriptionSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
