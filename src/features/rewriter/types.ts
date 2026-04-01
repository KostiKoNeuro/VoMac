export interface RewriterPreset {
  id: string;
  name: string;
  icon: string;
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
