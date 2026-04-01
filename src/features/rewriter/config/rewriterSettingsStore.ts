import type { RewriterPreset, RewriterSettings } from "../types";

const STORAGE_KEY = "vo.rewriter.settings";

export const defaultRewriterSettings: RewriterSettings = {
  hotkey: "Ctrl+Alt+Space",
  provider: "openai",
  apiKeyOverride: "",
  baseUrlOverride: "",
  model: "gpt-4o",
  presets: [],
};

export function loadRewriterSettings(): RewriterSettings {
  if (typeof window === "undefined") {
    return defaultRewriterSettings;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return defaultRewriterSettings;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<RewriterSettings>;

    return {
      hotkey:
        typeof parsed.hotkey === "string" && parsed.hotkey.trim().length > 0
          ? parsed.hotkey
          : defaultRewriterSettings.hotkey,
      provider:
        typeof parsed.provider === "string" && parsed.provider.trim().length > 0
          ? parsed.provider
          : defaultRewriterSettings.provider,
      apiKeyOverride:
        typeof parsed.apiKeyOverride === "string"
          ? parsed.apiKeyOverride
          : defaultRewriterSettings.apiKeyOverride,
      baseUrlOverride:
        typeof parsed.baseUrlOverride === "string"
          ? parsed.baseUrlOverride
          : defaultRewriterSettings.baseUrlOverride,
      model:
        typeof parsed.model === "string" && parsed.model.trim().length > 0
          ? parsed.model
          : defaultRewriterSettings.model,
      presets: Array.isArray(parsed.presets)
        ? parsed.presets.filter(isValidPreset)
        : defaultRewriterSettings.presets,
    };
  } catch {
    return defaultRewriterSettings;
  }
}

export function saveRewriterSettings(settings: RewriterSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isValidPreset(value: unknown): value is RewriterPreset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RewriterPreset>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.icon === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.isEnabled === "boolean"
  );
}
