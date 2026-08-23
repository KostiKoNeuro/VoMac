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
  /** Continuous mic loudness 0..1 driving the orb animation. */
  volume?: number;
  errorTitle?: string;
  errorText?: string;
  successText?: string;
  onStart?: () => void;
  onStop?: () => void;
  onAbort?: () => void;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}
