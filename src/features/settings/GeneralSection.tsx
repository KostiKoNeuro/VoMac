import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { SettingsRow } from "../../components/SettingsRow";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Toggle } from "../../components/ui/Toggle";
import { Notice } from "../../components/ui/Notice";
import { Select } from "../../components/ui/Select";
import {
  loadSharedGeneralSettings,
  saveSharedGeneralLanguage,
  saveSharedGeneralSettings,
  listenForSharedGeneralSettingsSync,
} from "../../lib/sharedState";
import { defaultGeneralSettings } from "./config/generalSettingsStore";
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart";
import { setAppLanguage, translate, useTranslation } from "../../lib/i18n";

export function GeneralSection() {
  const { t } = useTranslation();
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [closeToTray, setCloseToTray] = useState(defaultGeneralSettings.closeToTray);
  const [showNotifications, setShowNotifications] = useState(defaultGeneralSettings.showNotifications);
  const [profileName, setProfileName] = useState(defaultGeneralSettings.profileName);
  const [language, setLanguage] = useState(defaultGeneralSettings.language);
  const [alwaysCopyToClipboard, setAlwaysCopyToClipboard] = useState(defaultGeneralSettings.alwaysCopyToClipboard);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    const loadSettings = async () => {
      const current = await loadSharedGeneralSettings();
      if (!mounted) return;
      setCloseToTray(current.closeToTray);
      setShowNotifications(current.showNotifications);
      setProfileName(current.profileName);
      setLanguage(current.language);
      setAlwaysCopyToClipboard(current.alwaysCopyToClipboard);

      try {
        const autostartEnabled = await isEnabled();
        if (mounted) setLaunchOnStartup(autostartEnabled);
      } catch (error) {
        console.error("Failed to check autostart status:", error);
      }
    };

    void loadSettings();
    void listenForSharedGeneralSettingsSync(loadSettings).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  async function handleAutostartToggle(checked: boolean) {
    setLaunchOnStartup(checked);
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
    } catch (error) {
      console.error("Failed to toggle autostart:", error);
      setLaunchOnStartup(!checked);
    }
  }

  async function handleLanguageChange(nextLanguage: "en" | "ru") {
    setLanguage(nextLanguage);
    setAppLanguage(nextLanguage);

    try {
      await saveSharedGeneralLanguage(nextLanguage);
    } catch (error) {
      console.error("Failed to save interface language:", error);
    }
  }

  async function handleSave() {
    await saveSharedGeneralSettings({
      closeToTray,
      showNotifications,
      profileName,
      language,
      alwaysCopyToClipboard,
    });
    setSaveMessage(translate("general.saved"));
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
  }

  async function handleReset() {
    setCloseToTray(defaultGeneralSettings.closeToTray);
    setShowNotifications(defaultGeneralSettings.showNotifications);
    setProfileName(defaultGeneralSettings.profileName);
    setLanguage(defaultGeneralSettings.language);
    setAlwaysCopyToClipboard(defaultGeneralSettings.alwaysCopyToClipboard);
    setAppLanguage(defaultGeneralSettings.language);
    await saveSharedGeneralSettings(defaultGeneralSettings);
    setSaveMessage(translate("general.reset.msg"));
    setTimeout(() => {
      setSaveMessage(null);
    }, 3000);
  }

  const languageOptions = [
    { value: "en", label: t("common.language.en") },
    { value: "ru", label: t("common.language.ru") },
  ];

  return (
    <div className="grid gap-5">
      <SectionCard
        title={t("general.title")}
        description={t("general.desc")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleReset}>{t("general.reset")}</Button>
            <Button variant="primary" onClick={handleSave}>{t("general.save")}</Button>
          </div>
        }
      >
        <div className="space-y-1">
          <SettingsRow
            label={t("general.language.label")}
            description={t("general.language.desc")}
            control={
              <Select
                label={t("general.language.label")}
                value={language}
                onChange={(event) => {
                  void handleLanguageChange(event.target.value as "en" | "ru");
                }}
                options={languageOptions}
                aria-label={t("general.language.selectAria")}
              />
            }
          />
          <SettingsRow
            label={t("general.profile.label")}
            description={t("general.profile.desc")}
            control={
              <Input
                label={t("general.profile.inputLabel")}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
              />
            }
          />
          <SettingsRow
            label={t("general.autostart.label")}
            description={t("general.autostart.desc")}
            control={
              <Toggle
                checked={launchOnStartup}
                onCheckedChange={handleAutostartToggle}
                ariaLabel={t("general.autostart.aria")}
              />
            }
          />
          <SettingsRow
            label={t("general.tray.label")}
            description={t("general.tray.desc")}
            control={
              <Toggle
                checked={closeToTray}
                onCheckedChange={setCloseToTray}
                ariaLabel={t("general.tray.aria")}
              />
            }
          />
          <SettingsRow
            label={t("general.notifications.label")}
            description={t("general.notifications.desc")}
            control={
              <Toggle
                checked={showNotifications}
                onCheckedChange={setShowNotifications}
                ariaLabel={t("general.notifications.aria")}
              />
            }
          />
          <SettingsRow
            label={t("general.clipboard.label")}
            description={t("general.clipboard.desc")}
            control={
              <Toggle
                checked={alwaysCopyToClipboard}
                onCheckedChange={setAlwaysCopyToClipboard}
                ariaLabel={t("general.clipboard.aria")}
              />
            }
          />
        </div>
        {saveMessage ? (
          <Notice tone="success" className="mt-4">
            {saveMessage}
          </Notice>
        ) : null}
      </SectionCard>
    </div>
  );
}