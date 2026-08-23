export interface GeneralSettings {
  profileName: string;
  closeToTray: boolean;
  showNotifications: boolean;
  language: "en" | "ru";
  alwaysCopyToClipboard: boolean;
  /** Type streaming finals straight into the focused field while dictating. */
  liveInsert: boolean;
  /** Saved dictation shortcut; empty means the built-in default is used. */
  dictationHotkey: string;
}
