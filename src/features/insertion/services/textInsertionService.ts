import { translate } from "../../../lib/i18n";
import { isTauriRuntime } from "../../../lib/tauri/runtime";
import type { InsertionAttemptResult, NativeInsertionResult } from "../types";

function normalizeNativeStrategy(
  method: string,
): InsertionAttemptResult["strategy"] {
  return method === "native_wm_paste" ? "native_wm_paste" : "native_clipboard_paste";
}

async function tryNativeInsertion(text: string): Promise<InsertionAttemptResult | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const result = await invoke<NativeInsertionResult>("insert_text_mvp", { text });
    if (result.inserted) {
      return {
        status: "inserted",
        strategy: normalizeNativeStrategy(result.method),
        message: translate("insertion.inserted"),
      };
    }

    return {
      status: "failed",
      strategy: normalizeNativeStrategy(result.method),
      message:
        result.error ||
        translate("insertion.nativeFailed"),
    };
  } catch {
    return {
      status: "failed",
      strategy: "native_clipboard_paste",
      message: translate("insertion.nativeCommandFailed"),
    };
  }
}

async function tryClipboardFallback(text: string): Promise<InsertionAttemptResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return {
      status: "failed",
      strategy: "none",
      message: translate("insertion.clipboardUnavailable"),
    };
  }

  try {
    await navigator.clipboard.writeText(text);
    return {
      status: "copied",
      strategy: "web_clipboard_only",
      message: translate("insertion.copiedFallback"),
    };
  } catch {
    return {
      status: "failed",
      strategy: "none",
      message: translate("insertion.fallbackUnavailable"),
    };
  }
}

export async function insertTextWithFallback(text: string): Promise<InsertionAttemptResult> {
  if (!text.trim()) {
    return {
      status: "failed",
      strategy: "none",
      message: translate("insertion.emptyText"),
    };
  }

  const nativeResult = await tryNativeInsertion(text);
  if (nativeResult?.status === "inserted") {
    return nativeResult;
  }

  const clipboardResult = await tryClipboardFallback(text);
  if (clipboardResult.status === "copied") {
    return clipboardResult;
  }

  return nativeResult ?? clipboardResult;
}