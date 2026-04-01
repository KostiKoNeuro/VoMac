import type { TranscriptionProvider } from "../transcription/types";

export type HistoryItemStatus =
  | "pending"
  | "inserted"
  | "copied"
  | "failed"
  | "blocked";

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
}

export interface CreateHistoryItemInput {
  text: string;
  provider: TranscriptionProvider;
  model: string;
  createdAt?: number;
}
