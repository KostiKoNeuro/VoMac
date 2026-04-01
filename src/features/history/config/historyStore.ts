import type { TranscriptionHistoryItem } from "../types";

const STORAGE_KEY = "vo.transcription.history";
const MAX_HISTORY_ITEMS = 100;

function isHistoryItemLike(value: unknown): value is TranscriptionHistoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<TranscriptionHistoryItem>;
  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.createdAt === "number" &&
    typeof item.charLength === "number" &&
    typeof item.wordCount === "number" &&
    typeof item.provider === "string" &&
    typeof item.model === "string" &&
    typeof item.status === "string"
  );
}

export function loadHistoryItems(): TranscriptionHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isHistoryItemLike)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function saveHistoryItems(items: TranscriptionHistoryItem[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const safeItems = items
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_HISTORY_ITEMS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
}
