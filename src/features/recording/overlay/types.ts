export type OverlayPillState =
  | "idle"
  | "listening"
  | "processing"
  | "success"
  | "error";

export interface DictationOverlayPillProps {
  state: OverlayPillState;
  interactive?: boolean;
  timerLabel?: string;
  errorTitle?: string;
  errorText?: string;
  successText?: string;
  onStart?: () => void;
  onStop?: () => void;
  onAbort?: () => void;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}
