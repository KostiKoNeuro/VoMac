import { translate } from "../i18n";
import type { HotkeyStatus } from "../../types/hotkey";
import { isApplePlatform } from "../platform";
import { isTauriRuntime } from "./runtime";

// Mirrors the Rust defaults in src-tauri/src/hotkey.rs.
const DEFAULT_SHORTCUT = isApplePlatform
  ? "Command+Shift+Space"
  : "Ctrl+Shift+Space";

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

const REWRITER_DEFAULT_SHORTCUT = isApplePlatform
  ? "Command+Alt+Space"
  : "Ctrl+Alt+Space";

export async function getRewriterHotkeyStatus(): Promise<HotkeyStatus> {
  if (!isTauriRuntime()) {
    return {
      shortcut: REWRITER_DEFAULT_SHORTCUT,
      isRegistered: false,
      lastError: getWebRuntimeNotice(),
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HotkeyStatus>("get_rewriter_hotkey_status");
}

export async function setRewriterHotkey(shortcut: string): Promise<HotkeyStatus> {
  if (!isTauriRuntime()) {
    return {
      shortcut,
      isRegistered: false,
      lastError: getWebRuntimeNotice(),
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HotkeyStatus>("set_rewriter_hotkey", { shortcut });
}

export async function suspendRewriterHotkey(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("suspend_rewriter_hotkey");
}

export async function resumeRewriterHotkey(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("resume_rewriter_hotkey");
}