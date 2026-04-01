export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

export type TranscriptionProvider = string;

export interface TranscriptionSettings {
  provider: TranscriptionProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  languageHint: string;
  customProviders: CustomProviderConfig[];
}

export interface TranscriptionResult {
  text: string;
  model: string;
  provider: TranscriptionProvider;
  createdAt: number;
}

export interface TranscribeAudioInput {
  audioFile: File;
  settings: TranscriptionSettings;
  signal?: AbortSignal;
}
