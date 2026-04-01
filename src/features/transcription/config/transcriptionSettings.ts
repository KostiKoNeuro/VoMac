import type { TranscriptionProvider, TranscriptionSettings, CustomProviderConfig } from "../types";

export interface TranscriptionModelOption {
  label: string;
  value: string;
}

export interface ProviderPreset {
  label: string;
  value: TranscriptionProvider;
  baseUrl: string;
  sttSupported: boolean;
  chatSupported: boolean;
  defaultSttModel: string;
  defaultChatModel: string;
}

/** Built-in providers that are always available. */
export const providerPresets: ProviderPreset[] = [
  {
    label: "OpenAI",
    value: "openai",
    baseUrl: "https://api.openai.com/v1",
    sttSupported: true,
    chatSupported: true,
    defaultSttModel: "gpt-4o-transcribe",
    defaultChatModel: "gpt-4o",
  },
  {
    label: "OpenRouter",
    value: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    sttSupported: false,
    chatSupported: true,
    defaultSttModel: "",
    defaultChatModel: "openai/gpt-4o",
  },
];

/**
 * Returns dropdown options for the provider selector.
 * Includes built-in providers + any custom providers.
 */
export function buildProviderOptions(
  customProviders: CustomProviderConfig[],
): Array<{ label: string; value: string }> {
  const builtIn = providerPresets.map((p) => ({ label: p.label, value: p.value }));
  const custom = customProviders.map((cp) => ({
    label: cp.name || `Custom (${cp.id})`,
    value: `custom_${cp.id}`,
  }));
  return [...builtIn, ...custom];
}

/** Kept for backward compatibility — built-in options only. */
export const transcriptionProviderOptions: Array<{
  label: string;
  value: TranscriptionProvider;
}> = providerPresets.map((p) => ({ label: p.label, value: p.value }));

/**
 * Returns a ProviderPreset for a given provider ID.
 * If the provider is a custom one (custom_xxx), builds a preset from the custom config.
 */
export function getProviderPreset(
  provider: TranscriptionProvider,
  customProviders: CustomProviderConfig[] = [],
): ProviderPreset {
  // Check built-in presets first
  const builtIn = providerPresets.find((p) => p.value === provider);
  if (builtIn) return builtIn;

  // Check custom providers (provider value is "custom_<id>")
  if (provider.startsWith("custom_")) {
    const customId = provider.slice("custom_".length);
    const cp = customProviders.find((c) => c.id === customId);
    if (cp) {
      return {
        label: cp.name,
        value: provider,
        baseUrl: cp.baseUrl,
        sttSupported: true,
        chatSupported: true,
        defaultSttModel: "",
        defaultChatModel: "",
      };
    }
  }

  // Fallback to first built-in
  return providerPresets[0];
}

export const languageHintOptions: Array<{ label: string; value: string }> = [
  { label: "Auto detect", value: "" },
  { label: "Русский (ru)", value: "ru" },
  { label: "English (en)", value: "en" },
  { label: "Українська (uk)", value: "uk" },
  { label: "Deutsch (de)", value: "de" },
  { label: "Français (fr)", value: "fr" },
  { label: "Español (es)", value: "es" },
  { label: "中文 (zh)", value: "zh" },
  { label: "日本語 (ja)", value: "ja" },
  { label: "한국어 (ko)", value: "ko" },
  { label: "Português (pt)", value: "pt" },
  { label: "Italiano (it)", value: "it" },
  { label: "Polski (pl)", value: "pl" },
  { label: "Türkçe (tr)", value: "tr" },
  { label: "العربية (ar)", value: "ar" },
];

export const defaultTranscriptionSettings: TranscriptionSettings = {
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-transcribe",
  languageHint: "",
  customProviders: [],
};
