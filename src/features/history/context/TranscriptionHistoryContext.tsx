import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  listenForSharedHistorySync,
  loadSharedHistoryItems,
  saveSharedHistoryItems,
} from "../../../lib/sharedState";
import type {
  CreateHistoryItemInput,
  HistoryItemStatus,
  TranscriptionHistoryItem,
} from "../types";

interface TranscriptionHistoryContextValue {
  items: TranscriptionHistoryItem[];
  addHistoryItem: (input: CreateHistoryItemInput) => TranscriptionHistoryItem;
  deleteHistoryItem: (itemId: string) => void;
  clearHistory: () => void;
  markCopied: (itemId: string) => void;
  setItemStatus: (itemId: string, status: HistoryItemStatus, errorMessage?: string) => void;
}

const TranscriptionHistoryContext =
  createContext<TranscriptionHistoryContextValue | null>(null);

interface TranscriptionHistoryProviderProps {
  children: ReactNode;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000).toString(16)}`;
}

function createHistoryItem(input: CreateHistoryItemInput): TranscriptionHistoryItem {
  const text = input.text.trim();
  const createdAt = input.createdAt ?? Date.now();
  const wordCount = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;

  return {
    id: createId(),
    text,
    createdAt,
    charLength: text.length,
    wordCount,
    provider: input.provider,
    model: input.model,
    status: "pending",
    insertedAt: null,
    copiedAt: null,
    failedAt: null,
    errorMessage: null,
  };
}

export function TranscriptionHistoryProvider({
  children,
}: TranscriptionHistoryProviderProps) {
  const [items, setItems] = useState<TranscriptionHistoryItem[]>([]);

  const saveAndSet = useCallback((nextItems: TranscriptionHistoryItem[]) => {
    setItems(nextItems);
    void saveSharedHistoryItems(nextItems);
  }, []);

  const reloadHistory = useCallback(async () => {
    const nextItems = await loadSharedHistoryItems();
    setItems(nextItems);
  }, []);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    void reloadHistory();
    void listenForSharedHistorySync(async () => {
      if (!mounted) {
        return;
      }

      await reloadHistory();
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }

      unlisten = cleanup;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [reloadHistory]);

  const addHistoryItem = useCallback(
    (input: CreateHistoryItemInput) => {
      const nextItem = createHistoryItem(input);
      setItems((currentItems) => {
        const nextItems = [nextItem, ...currentItems];
        void saveSharedHistoryItems(nextItems);
        return nextItems;
      });

      return nextItem;
    },
    [],
  );

  const deleteHistoryItem = useCallback((itemId: string) => {
    setItems((currentItems) => {
      const nextItems = currentItems.filter((item) => item.id !== itemId);
      void saveSharedHistoryItems(nextItems);
      return nextItems;
    });
  }, []);

  const clearHistory = useCallback(() => {
    saveAndSet([]);
  }, [saveAndSet]);

  const markCopied = useCallback((itemId: string) => {
      setItems((currentItems) => {
        const nextItems: TranscriptionHistoryItem[] = currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: "copied" as const,
              copiedAt: Date.now(),
              errorMessage: null,
            }
          : item,
      );
      void saveSharedHistoryItems(nextItems);
      return nextItems;
    });
  }, []);

  const setItemStatus = useCallback(
    (itemId: string, status: HistoryItemStatus, errorMessage?: string) => {
      setItems((currentItems) => {
        const now = Date.now();
        const nextItems: TranscriptionHistoryItem[] = currentItems.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          return {
            ...item,
            status,
            insertedAt: status === "inserted" ? now : item.insertedAt,
            copiedAt: status === "copied" ? now : item.copiedAt,
            failedAt: status === "failed" || status === "blocked" ? now : item.failedAt,
            errorMessage: errorMessage ?? null,
          };
        });

      void saveSharedHistoryItems(nextItems);
      return nextItems;
    });
  },
    [],
  );

  const value = useMemo<TranscriptionHistoryContextValue>(
    () => ({
      items,
      addHistoryItem,
      deleteHistoryItem,
      clearHistory,
      markCopied,
      setItemStatus,
    }),
    [addHistoryItem, clearHistory, deleteHistoryItem, items, markCopied, setItemStatus],
  );

  return (
    <TranscriptionHistoryContext.Provider value={value}>
      {children}
    </TranscriptionHistoryContext.Provider>
  );
}

export function useTranscriptionHistory() {
  const contextValue = useContext(TranscriptionHistoryContext);
  if (!contextValue) {
    throw new Error(
      "useTranscriptionHistory must be used inside TranscriptionHistoryProvider.",
    );
  }

  return contextValue;
}
