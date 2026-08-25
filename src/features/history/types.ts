import type { TranscriptionProvider } from "../transcription/types";

export type HistoryItemStatus =
  | "pending"
  | "inserted"
  | "copied"
  | "failed"
  | "blocked";

/** "rewrite" marks AI-rewritten entries; absent or "dictation" = raw dictation. */
export type HistoryItemKind = "dictation" | "rewrite";

export interface TranscriptionHistoryItem {
  id: string;
  text: string;
  createdAt: number;
  charLength: number;
  wordCount: number;
  provider: TranscriptionProvider;
  model: string;
  status: HistoryItemStatus;
  insertedAt: number | null;
  copiedAt: number | null;
  failedAt: number | null;
  errorMessage: string | null;
  kind?: HistoryItemKind;
  /** For rewrites: the original selected text before the rewrite. */
  sourceText?: string;
}

export interface CreateHistoryItemInput {
  text: string;
  provider: TranscriptionProvider;
  model: string;
  createdAt?: number;
}
