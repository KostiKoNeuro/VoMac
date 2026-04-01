import { translate } from "../i18n";
import type { HotkeyStatus } from "../../types/hotkey";
import { isTauriRuntime } from "./runtime";

const DEFAULT_SHORTCUT = "Ctrl+Shift+Space";

function getWebRuntimeNotice(): string {
  return translate("recording.hotkey.runtimeNotice");
}

export async function getHotkeyStatus(): Promise<HotkeyStatus> {
  if (!isTauriRuntime()) {
    return {
      shortcut: DEFAULT_SHORTCUT,
      isRegistered: false,
      lastError: getWebRuntimeNotice(),
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HotkeyStatus>("get_hotkey_status");
}

export async function setDictationHotkey(shortcut: string): Promise<HotkeyStatus> {
  if (!isTauriRuntime()) {
    return {
      shortcut,
      isRegistered: false,
      lastError: getWebRuntimeNotice(),
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HotkeyStatus>("set_dictation_hotkey", { shortcut });
}

export async function suspendDictationHotkey(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("suspend_dictation_hotkey");
}

export async function resumeDictationHotkey(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("resume_dictation_hotkey");
}