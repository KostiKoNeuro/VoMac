import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { loadHistoryItems, saveHistoryItems } from "../features/history/config/historyStore";
import type { TranscriptionHistoryItem } from "../features/history/types";
import { defaultTranscriptionSettings } from "../features/transcription/config/transcriptionSettings";
import {
  loadTranscriptionSettings,
  saveTranscriptionSettings,
} from "../features/transcription/config/transcriptionSettingsStore";
import type { TranscriptionSettings } from "../features/transcription/types";
import { isTauriRuntime } from "./tauri/runtime";
import { getCurrentAppWindowLabel } from "./tauri/window";
import {
  loadGeneralSettings,
  saveGeneralSettings,
  defaultGeneralSettings,
} from "../features/settings/config/generalSettingsStore";
import type { GeneralSettings } from "../features/settings/types";
import {
  loadRewriterSettings,
  saveRewriterSettings,
  defaultRewriterSettings,
} from "../features/rewriter/config/rewriterSettingsStore";
import type { RewriterSettings } from "../features/rewriter/types";

export const APP_EVENT_HISTORY_SYNC = "storage:history-sync";
export const APP_EVENT_TRANSCRIPTION_SETTINGS_SYNC = "storage:settings-sync";
export const APP_EVENT_GENERAL_SETTINGS_SYNC = "storage:general-settings-sync";
export const APP_EVENT_REWRITER_SETTINGS_SYNC = "storage:rewriter-settings-sync";

interface StorageSyncPayload {
  source: string;
}

function createSyncPayload(): StorageSyncPayload {
  return {
    source: getCurrentAppWindowLabel(),
  };
}

function shouldReloadFromPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return true;
  }

  const candidate = payload as Partial<StorageSyncPayload>;
  if (typeof candidate.source !== "string") {
    return true;
  }

  return candidate.source !== getCurrentAppWindowLabel();
}

export async function loadSharedTranscriptionSettings(): Promise<TranscriptionSettings> {
  if (!isTauriRuntime()) {
    return loadTranscriptionSettings();
  }

  const persistedSettings = await invoke<TranscriptionSettings>("load_transcription_settings");
  const localSettings = loadTranscriptionSettings();
  const persistedIsEmpty =
    persistedSettings.apiKey.trim().length === 0 &&
    persistedSettings.model === defaultTranscriptionSettings.model &&
    persistedSettings.provider === defaultTranscriptionSettings.provider &&
    persistedSettings.baseUrl === defaultTranscriptionSettings.baseUrl &&
    persistedSettings.languageHint.trim().length === 0 &&
    (!persistedSettings.customProviders || persistedSettings.customProviders.length === 0);

  if (
    persistedIsEmpty &&
    (
      localSettings.apiKey.trim().length > 0 ||
      localSettings.model.trim().length > 0 ||
      localSettings.baseUrl !== defaultTranscriptionSettings.baseUrl ||
      localSettings.languageHint.trim().length > 0 ||
      (localSettings.customProviders && localSettings.customProviders.length > 0)
    )
  ) {
    await invoke("save_transcription_settings", { settings: localSettings });
    return localSettings;
  }

  return persistedSettings;
}

export async function saveSharedTranscriptionSettings(
  settings: TranscriptionSettings,
): Promise<void> {
  if (!isTauriRuntime()) {
    saveTranscriptionSettings(settings);
    window.dispatchEvent(
      new CustomEvent<StorageSyncPayload>(APP_EVENT_TRANSCRIPTION_SETTINGS_SYNC, {
        detail: createSyncPayload(),
      }),
    );
    return;
  }

  await invoke("save_transcription_settings", { settings });
  await emit(APP_EVENT_TRANSCRIPTION_SETTINGS_SYNC, createSyncPayload());
}

export async function loadSharedGeneralSettings(): Promise<GeneralSettings> {
  if (!isTauriRuntime()) {
    return loadGeneralSettings();
  }

  const persistedSettings = await invoke<GeneralSettings>("load_general_settings");
  const localSettings = loadGeneralSettings();
  const persistedIsDefault =
    persistedSettings.profileName === defaultGeneralSettings.profileName &&
    persistedSettings.closeToTray === defaultGeneralSettings.closeToTray &&
    persistedSettings.showNotifications === defaultGeneralSettings.showNotifications &&
    persistedSettings.language === defaultGeneralSettings.language &&
    persistedSettings.alwaysCopyToClipboard === defaultGeneralSettings.alwaysCopyToClipboard &&
    persistedSettings.liveInsert === defaultGeneralSettings.liveInsert &&
    persistedSettings.dictationHotkey === defaultGeneralSettings.dictationHotkey &&
    persistedSettings.microphoneId === defaultGeneralSettings.microphoneId;

  const localIsNotDefault =
    localSettings.profileName !== defaultGeneralSettings.profileName ||
    localSettings.closeToTray !== defaultGeneralSettings.closeToTray ||
    localSettings.showNotifications !== defaultGeneralSettings.showNotifications ||
    localSettings.language !== defaultGeneralSettings.language ||
    localSettings.alwaysCopyToClipboard !== defaultGeneralSettings.alwaysCopyToClipboard ||
    localSettings.liveInsert !== defaultGeneralSettings.liveInsert ||
    localSettings.dictationHotkey !== defaultGeneralSettings.dictationHotkey ||
    localSettings.microphoneId !== defaultGeneralSettings.microphoneId;

  if (persistedIsDefault && localIsNotDefault) {
    await invoke("save_general_settings", { settings: localSettings });
    return localSettings;
  }

  return persistedSettings;
}

export async function saveSharedGeneralSettings(
  settings: GeneralSettings,
): Promise<void> {
  if (!isTauriRuntime()) {
    saveGeneralSettings(settings);
    window.dispatchEvent(
      new CustomEvent<StorageSyncPayload>(APP_EVENT_GENERAL_SETTINGS_SYNC, {
        detail: createSyncPayload(),
      }),
    );
    return;
  }

  await invoke("save_general_settings", { settings });
  await emit(APP_EVENT_GENERAL_SETTINGS_SYNC, createSyncPayload());
}

export async function saveSharedGeneralLanguage(
  language: GeneralSettings["language"],
): Promise<void> {
  const currentSettings = await loadSharedGeneralSettings();
  if (currentSettings.language === language) {
    return;
  }

  await saveSharedGeneralSettings({
    ...currentSettings,
    language,
  });
}

export async function loadSharedHistoryItems(): Promise<TranscriptionHistoryItem[]> {
  if (!isTauriRuntime()) {
    return loadHistoryItems();
  }

  const persistedItems = await invoke<TranscriptionHistoryItem[]>("load_history_items");
  const localItems = loadHistoryItems();

  if (persistedItems.length === 0 && localItems.length > 0) {
    await invoke("save_history_items", { items: localItems });
    return localItems;
  }

  return persistedItems;
}

export async function saveSharedHistoryItems(
  items: TranscriptionHistoryItem[],
): Promise<void> {
  if (!isTauriRuntime()) {
    saveHistoryItems(items);
    window.dispatchEvent(
      new CustomEvent<StorageSyncPayload>(APP_EVENT_HISTORY_SYNC, {
        detail: createSyncPayload(),
      }),
    );
    return;
  }

  await invoke("save_history_items", { items });
  await emit(APP_EVENT_HISTORY_SYNC, createSyncPayload());
}

export async function listenForSharedHistorySync(
  handler: () => void | Promise<void>,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<StorageSyncPayload>;
      if (shouldReloadFromPayload(customEvent.detail)) {
        void handler();
      }
    };

    window.addEventListener(APP_EVENT_HISTORY_SYNC, listener as EventListener);
    return () => {
      window.removeEventListener(APP_EVENT_HISTORY_SYNC, listener as EventListener);
    };
  }

  return listen<StorageSyncPayload>(APP_EVENT_HISTORY_SYNC, ({ payload }) => {
    if (shouldReloadFromPayload(payload)) {
      void handler();
    }
  });
}

export async function listenForSharedTranscriptionSettingsSync(
  handler: () => void | Promise<void>,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<StorageSyncPayload>;
      if (shouldReloadFromPayload(customEvent.detail)) {
        void handler();
      }
    };

    window.addEventListener(
      APP_EVENT_TRANSCRIPTION_SETTINGS_SYNC,
      listener as EventListener,
    );
    return () => {
      window.removeEventListener(
        APP_EVENT_TRANSCRIPTION_SETTINGS_SYNC,
        listener as EventListener,
      );
    };
  }

  return listen<StorageSyncPayload>(APP_EVENT_TRANSCRIPTION_SETTINGS_SYNC, ({ payload }) => {
    if (shouldReloadFromPayload(payload)) {
      void handler();
    }
  });
}

export async function listenForSharedGeneralSettingsSync(
  handler: () => void | Promise<void>,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<StorageSyncPayload>;
      if (shouldReloadFromPayload(customEvent.detail)) {
        void handler();
      }
    };

    window.addEventListener(
      APP_EVENT_GENERAL_SETTINGS_SYNC,
      listener as EventListener,
    );
    return () => {
      window.removeEventListener(
        APP_EVENT_GENERAL_SETTINGS_SYNC,
        listener as EventListener,
      );
    };
  }

  return listen<StorageSyncPayload>(APP_EVENT_GENERAL_SETTINGS_SYNC, ({ payload }) => {
    if (shouldReloadFromPayload(payload)) {
      void handler();
    }
  });
}

export async function loadSharedRewriterSettings(): Promise<RewriterSettings> {
  if (!isTauriRuntime()) {
    return loadRewriterSettings();
  }

  const persistedSettings = await invoke<RewriterSettings>("load_rewriter_settings");
  const localSettings = loadRewriterSettings();
  const persistedIsDefault =
    persistedSettings.hotkey === defaultRewriterSettings.hotkey &&
    persistedSettings.provider === defaultRewriterSettings.provider &&
    persistedSettings.apiKeyOverride === defaultRewriterSettings.apiKeyOverride &&
    persistedSettings.baseUrlOverride === defaultRewriterSettings.baseUrlOverride &&
    persistedSettings.model === defaultRewriterSettings.model &&
    persistedSettings.presets.length === 0;

  const localIsNotDefault =
    localSettings.hotkey !== defaultRewriterSettings.hotkey ||
    localSettings.provider !== defaultRewriterSettings.provider ||
    localSettings.apiKeyOverride !== defaultRewriterSettings.apiKeyOverride ||
    localSettings.baseUrlOverride !== defaultRewriterSettings.baseUrlOverride ||
    localSettings.model !== defaultRewriterSettings.model ||
    localSettings.presets.length > 0;

  if (persistedIsDefault && localIsNotDefault) {
    await invoke("save_rewriter_settings", { settings: localSettings });
    return localSettings;
  }

  return persistedSettings;
}

export async function saveSharedRewriterSettings(
  settings: RewriterSettings,
): Promise<void> {
  if (!isTauriRuntime()) {
    saveRewriterSettings(settings);
    window.dispatchEvent(
      new CustomEvent<StorageSyncPayload>(APP_EVENT_REWRITER_SETTINGS_SYNC, {
        detail: createSyncPayload(),
      }),
    );
    return;
  }

  await invoke("save_rewriter_settings", { settings });
  await emit(APP_EVENT_REWRITER_SETTINGS_SYNC, createSyncPayload());
}

export async function listenForSharedRewriterSettingsSync(
  handler: () => void | Promise<void>,
): Promise<UnlistenFn> {
  if (!isTauriRuntime()) {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<StorageSyncPayload>;
      if (shouldReloadFromPayload(customEvent.detail)) {
        void handler();
      }
    };

    window.addEventListener(
      APP_EVENT_REWRITER_SETTINGS_SYNC,
      listener as EventListener,
    );
    return () => {
      window.removeEventListener(
        APP_EVENT_REWRITER_SETTINGS_SYNC,
        listener as EventListener,
      );
    };
  }

  return listen<StorageSyncPayload>(APP_EVENT_REWRITER_SETTINGS_SYNC, ({ payload }) => {
    if (shouldReloadFromPayload(payload)) {
      void handler();
    }
  });
}
