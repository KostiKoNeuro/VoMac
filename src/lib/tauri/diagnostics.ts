import { isTauriRuntime } from "./runtime";

interface RuntimeDiagnosticPayload {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

function buildMessage(payload: RuntimeDiagnosticPayload): string {
  return JSON.stringify(payload);
}

export async function logRuntimeDiagnostic(
  scope: string,
  event: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const message = buildMessage({
    event,
    timestamp: new Date().toISOString(),
    details,
  });

  if (!isTauriRuntime()) {
    console.info(`[vo][${scope}] ${message}`);
    return;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("log_runtime_diagnostic", { scope, message });
  } catch (error) {
    console.info(`[vo][${scope}] ${message}`, error);
  }
}
