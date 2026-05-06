import type { RewriterIconKey } from "./config/rewriterIcons";

export interface RewriterPreset {
  id: string;
  name: string;
  icon: RewriterIconKey;
  prompt: string;
  isEnabled: boolean;
}

export interface RewriterSettings {
  hotkey: string;
  provider: string;
  apiKeyOverride: string;
  baseUrlOverride: string;
  model: string;
  presets: RewriterPreset[];
}
