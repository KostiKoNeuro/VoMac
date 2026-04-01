import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultTranscriptionSettings } from "../config/transcriptionSettings";
import {
  listenForSharedTranscriptionSettingsSync,
  loadSharedTranscriptionSettings,
  saveSharedTranscriptionSettings,
} from "../../../lib/sharedState";
import type { TranscriptionSettings } from "../types";

interface TranscriptionSettingsContextValue {
  settings: TranscriptionSettings;
  reloadSettings: () => Promise<TranscriptionSettings>;
  updateSettings: (nextSettings: TranscriptionSettings) => void;
}

const TranscriptionSettingsContext =
  createContext<TranscriptionSettingsContextValue | null>(null);

interface TranscriptionSettingsProviderProps {
  children: ReactNode;
}

export function TranscriptionSettingsProvider({
  children,
}: TranscriptionSettingsProviderProps) {
  const [settings, setSettings] =
    useState<TranscriptionSettings>(defaultTranscriptionSettings);

  const reloadSettings = useCallback(async () => {
    const nextSettings = await loadSharedTranscriptionSettings();
    setSettings(nextSettings);
    return nextSettings;
  }, []);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    void reloadSettings();
    void listenForSharedTranscriptionSettingsSync(async () => {
      if (!mounted) {
        return;
      }

      await reloadSettings();
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
  }, [reloadSettings]);

  const value = useMemo<TranscriptionSettingsContextValue>(
    () => ({
      settings,
      reloadSettings,
      updateSettings: (nextSettings) => {
        const sanitizedSettings: TranscriptionSettings = {
          ...defaultTranscriptionSettings,
          ...nextSettings,
          apiKey: nextSettings.apiKey.trim(),
        };
        setSettings(sanitizedSettings);
        void saveSharedTranscriptionSettings(sanitizedSettings);
      },
    }),
    [reloadSettings, settings],
  );

  return (
    <TranscriptionSettingsContext.Provider value={value}>
      {children}
    </TranscriptionSettingsContext.Provider>
  );
}

export function useTranscriptionSettings() {
  const contextValue = useContext(TranscriptionSettingsContext);
  if (!contextValue) {
    throw new Error(
      "useTranscriptionSettings must be used inside TranscriptionSettingsProvider.",
    );
  }

  return contextValue;
}
