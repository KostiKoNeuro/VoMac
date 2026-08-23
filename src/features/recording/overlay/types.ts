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
  /** Live streaming transcript shown while listening (optional). */
  liveText?: string;
  errorTitle?: string;
  errorText?: string;
  successText?: string;
  onStart?: () => void;
  onStop?: () => void;
  onAbort?: () => void;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}
