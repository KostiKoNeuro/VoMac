import type { RewriterPreset, RewriterSettings } from "../types";
import { REWRITER_ICONS, type RewriterIconKey } from "./rewriterIcons";

const VALID_ICON_KEYS = new Set(REWRITER_ICONS.map((e) => e.key)) as Set<RewriterIconKey>;

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
        ? parsed.presets.map(migratePreset).filter(Boolean) as RewriterPreset[]
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

function migratePresetIcon(icon: string): RewriterIconKey {
  // Old emoji-based presets had freeform strings — migrate to a default
  if (VALID_ICON_KEYS.has(icon as RewriterIconKey)) {
    return icon as RewriterIconKey;
  }
  return "sparkles";
}

function isValidPreset(value: unknown): value is RewriterPreset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RewriterPreset>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.isEnabled === "boolean"
  );
}

function migratePreset(value: unknown): RewriterPreset | null {
  if (!isValidPreset(value)) return null;
  const p = value as RewriterPreset;
  return {
    ...p,
    icon: migratePresetIcon(p.icon),
  };
}
