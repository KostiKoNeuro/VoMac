import { isTauriRuntime } from "./runtime";
import {
  APP_EVENT_DICTATION_TRIGGERED,
  APP_EVENT_SHOW_HISTORY,
} from "./events";

export const TRAY_EVENT_START_DICTATION = APP_EVENT_DICTATION_TRIGGERED;
export const TRAY_EVENT_SHOW_HISTORY = APP_EVENT_SHOW_HISTORY;

interface TrayEventHandlers {
  onStartDictation?: () => void;
  onShowHistory?: () => void;
}

export async function registerTrayEventHandlers({
  onStartDictation,
  onShowHistory,
}: TrayEventHandlers): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const { listen } = await import("@tauri-apps/api/event");
  const unlistenStart = await listen(TRAY_EVENT_START_DICTATION, () => {
    onStartDictation?.();
  });
  const unlistenHistory = await listen(TRAY_EVENT_SHOW_HISTORY, () => {
    onShowHistory?.();
  });

  return () => {
    unlistenStart();
    unlistenHistory();
  };
}
