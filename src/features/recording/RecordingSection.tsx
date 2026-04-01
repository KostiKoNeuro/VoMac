import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { SettingsRow } from "../../components/SettingsRow";
import { Button } from "../../components/ui/Button";
import { HotkeyInput } from "../../components/ui/HotkeyInput";
import { Notice } from "../../components/ui/Notice";
import { PillBadge } from "../../components/ui/PillBadge";
import { Toggle } from "../../components/ui/Toggle";
import { translate, useTranslation } from "../../lib/i18n";
import { getHotkeyStatus, setDictationHotkey } from "../../lib/tauri/hotkey";
import type { HotkeyStatus } from "../../types/hotkey";

function localizeHotkeyError(message: string): string {
  if (message === "Shortcut cannot be empty.") {
    return translate("recording.hotkey.error.empty");
  }

  if (message === "Shortcut is too long.") {
    return translate("recording.hotkey.error.tooLong");
  }

  const registrationPrefix = "Shortcut registration failed:";
  if (message.startsWith(registrationPrefix)) {
    const details = message.slice(registrationPrefix.length).trim();
    const localizedPrefix = translate("recording.hotkey.error.registrationFailed");
    return details ? `${localizedPrefix}: ${details}` : localizedPrefix;
  }

  return message;
}

export function RecordingSection() {
  const { t } = useTranslation();
  const [pushToTalk, setPushToTalk] = useState("Ctrl+Shift+Space");
  const [hotkeyStatus, setHotkeyStatus] = useState<HotkeyStatus | null>(null);
  const [isSavingHotkey, setIsSavingHotkey] = useState(false);
  const [smartGain, setSmartGain] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoStopSilence, setAutoStopSilence] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getHotkeyStatus().then((status) => {
      if (!mounted) {
        return;
      }

      setHotkeyStatus(status);
      setPushToTalk(status.shortcut);
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleHotkeySave() {
    setIsSavingHotkey(true);

    try {
      const updatedStatus = await setDictationHotkey(pushToTalk);
      setHotkeyStatus(updatedStatus);
      setPushToTalk(updatedStatus.shortcut);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : translate("recording.hotkey.updateError");
      setHotkeyStatus((currentValue) => ({
        ...(currentValue ?? {
          shortcut: pushToTalk,
          isRegistered: false,
          lastError: null,
        }),
        shortcut: pushToTalk,
        isRegistered: false,
        lastError: errorMessage,
      }));
    } finally {
      setIsSavingHotkey(false);
    }
  }

  const hotkeyBadgeTone = hotkeyStatus?.isRegistered ? "success" : "error";
  const hotkeyBadgeLabel = hotkeyStatus?.isRegistered
    ? t("recording.hotkey.badge.registered")
    : t("recording.hotkey.badge.notRegistered");
  const localizedHotkeyError = hotkeyStatus?.lastError
    ? localizeHotkeyError(hotkeyStatus.lastError)
    : null;

  return (
    <div className="grid gap-5">
      <SectionCard
        title={t("recording.title")}
        description={t("recording.desc")}
      >
        <div className="space-y-1">
          <SettingsRow
            label={t("recording.hotkey.label")}
            description={t("recording.hotkey.desc")}
            control={
              <div className="space-y-2">
                <HotkeyInput
                  label={t("recording.hotkey.inputLabel")}
                  value={pushToTalk}
                  onChange={(value) => setPushToTalk(value)}
                  hint={t("recording.hotkey.inputHint")}
                />
                <div className="flex items-center justify-between gap-2">
                  <PillBadge tone={hotkeyBadgeTone}>{hotkeyBadgeLabel}</PillBadge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleHotkeySave}
                    disabled={isSavingHotkey}
                  >
                    {isSavingHotkey ? t("recording.hotkey.saving") : t("recording.hotkey.apply")}
                  </Button>
                </div>
                {localizedHotkeyError ? (
                  <Notice tone="error" title={t("recording.hotkey.error.title")}>
                    {localizedHotkeyError}
                  </Notice>
                ) : null}
              </div>
            }
          />
          <SettingsRow
            label={t("recording.smartGain.label")}
            description={t("recording.smartGain.desc")}
            control={
              <Toggle
                checked={smartGain}
                onCheckedChange={setSmartGain}
                ariaLabel={t("recording.smartGain.aria")}
              />
            }
          />
          <SettingsRow
            label={t("recording.noiseSuppression.label")}
            description={t("recording.noiseSuppression.desc")}
            control={
              <Toggle
                checked={noiseSuppression}
                onCheckedChange={setNoiseSuppression}
                ariaLabel={t("recording.noiseSuppression.aria")}
              />
            }
          />
          <SettingsRow
            label={t("recording.autoStop.label")}
            description={t("recording.autoStop.desc")}
            control={
              <Toggle
                checked={autoStopSilence}
                onCheckedChange={setAutoStopSilence}
                ariaLabel={t("recording.autoStop.aria")}
              />
            }
          />
        </div>
      </SectionCard>
    </div>
  );
}