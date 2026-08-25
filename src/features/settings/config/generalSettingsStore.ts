import type { GeneralSettings } from "../types";

const STORAGE_KEY = "vo.general.settings";

export const defaultGeneralSettings: GeneralSettings = {
  profileName: "Personal workstation",
  closeToTray: false,
  showNotifications: true,
  language: "ru",
  alwaysCopyToClipboard: false,
  liveInsert: false,
  dictationHotkey: "",
  microphoneId: "",
};

export function loadGeneralSettings(): GeneralSettings {
  if (typeof window === "undefined") {
    return defaultGeneralSettings;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return defaultGeneralSettings;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<GeneralSettings>;
    
    return {
      profileName: typeof parsed.profileName === "string" ? parsed.profileName : defaultGeneralSettings.profileName,
      closeToTray: typeof parsed.closeToTray === "boolean" ? parsed.closeToTray : defaultGeneralSettings.closeToTray,
      showNotifications: typeof parsed.showNotifications === "boolean" ? parsed.showNotifications : defaultGeneralSettings.showNotifications,
      language: (parsed.language === "en" || parsed.language === "ru") ? parsed.language : defaultGeneralSettings.language,
      alwaysCopyToClipboard: typeof parsed.alwaysCopyToClipboard === "boolean" ? parsed.alwaysCopyToClipboard : defaultGeneralSettings.alwaysCopyToClipboard,
      liveInsert: typeof parsed.liveInsert === "boolean" ? parsed.liveInsert : defaultGeneralSettings.liveInsert,
      dictationHotkey: typeof parsed.dictationHotkey === "string" ? parsed.dictationHotkey : defaultGeneralSettings.dictationHotkey,
      microphoneId: typeof parsed.microphoneId === "string" ? parsed.microphoneId : defaultGeneralSettings.microphoneId,
    };
  } catch {
    return defaultGeneralSettings;
  }
}

export function saveGeneralSettings(settings: GeneralSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
