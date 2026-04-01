import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./runtime";

export type AppWindowLabel = "main" | "overlay" | "rewriter";

export function getCurrentAppWindowLabel(): AppWindowLabel {
  if (!isTauriRuntime()) {
    return "main";
  }

  const label = getCurrentWindow().label;
  if (label === "overlay") return "overlay";
  if (label === "rewriter") return "rewriter";
  return "main";
}

export async function markWindowReady(label: AppWindowLabel): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("mark_window_ready", { label });
}
