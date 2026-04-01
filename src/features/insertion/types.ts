export type InsertionStatus = "inserted" | "copied" | "failed";

export interface InsertionAttemptResult {
  status: InsertionStatus;
  strategy: "native_wm_paste" | "native_clipboard_paste" | "web_clipboard_only" | "none";
  message: string;
}

export interface NativeInsertionResult {
  inserted: boolean;
  method: string;
  error: string | null;
}
