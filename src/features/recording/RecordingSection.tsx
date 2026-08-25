import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SectionCard } from "../../components/SectionCard";
import { SettingsRow } from "../../components/SettingsRow";
import { Button } from "../../components/ui/Button";
import { HotkeyInput } from "../../components/ui/HotkeyInput";
import { IconButton } from "../../components/ui/IconButton";
import { Notice } from "../../components/ui/Notice";
import { PillBadge } from "../../components/ui/PillBadge";
import { Select } from "../../components/ui/Select";
import { translate, useTranslation } from "../../lib/i18n";
import { listAudioInputDevices, type AudioInputDevice } from "../../lib/audioDevices";
import {
  loadSharedGeneralSettings,
  saveSharedGeneralSettings,
  loadSharedRewriterSettings,
  saveSharedRewriterSettings,
} from "../../lib/sharedState";
import {
  getHotkeyStatus,
  setDictationHotkey,
  getRewriterHotkeyStatus,
  setRewriterHotkey as applyRewriterHotkey,
} from "../../lib/tauri/hotkey";
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
  const [microphones, setMicrophones] = useState<AudioInputDevice[]>([]);
  const [microphoneId, setMicrophoneId] = useState("");
  const [isRefreshingMics, setIsRefreshingMics] = useState(false);
  const [rewriterHotkey, setRewriterHotkey] = useState("");
  const [rewriterHotkeyStatus, setRewriterHotkeyStatus] = useState<HotkeyStatus | null>(null);
  const [isApplyingRewriterHotkey, setIsApplyingRewriterHotkey] = useState(false);

  useEffect(() => {
    let mounted = true;

    void getHotkeyStatus().then((status) => {
      if (!mounted) {
        return;
      }

      setHotkeyStatus(status);
      setPushToTalk(status.shortcut);
    });

    void loadSharedGeneralSettings().then((settings) => {
      if (mounted) {
        setMicrophoneId(settings.microphoneId);
      }
    });

    void loadSharedRewriterSettings().then((settings) => {
      if (mounted) {
        setRewriterHotkey(settings.hotkey);
      }
    });

    void getRewriterHotkeyStatus().then((status) => {
      if (mounted) {
        setRewriterHotkeyStatus(status);
        setRewriterHotkey(status.shortcut);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshMicrophones() {
    setIsRefreshingMics(true);
    try {
      const devices = await listAudioInputDevices();
      setMicrophones(devices);
    } catch (error) {
      console.error("Failed to list audio input devices:", error);
    } finally {
      setIsRefreshingMics(false);
    }
  }

  useEffect(() => {
    void refreshMicrophones();
  }, []);

  async function handleMicrophoneChange(nextId: string) {
    setMicrophoneId(nextId);
    try {
      const current = await loadSharedGeneralSettings();
      await saveSharedGeneralSettings({ ...current, microphoneId: nextId });
    } catch (error) {
      console.error("Failed to save microphone selection:", error);
    }
  }

  // Applies + persists the rewriter hotkey from here so both trigger keys
  // live in one place. RewriterSection picks the change up via its sync
  // listener, so its own "Save" can never overwrite this.
  async function handleApplyRewriterHotkey() {
    if (!rewriterHotkey.trim()) return;
    setIsApplyingRewriterHotkey(true);

    try {
      const updatedStatus = await applyRewriterHotkey(rewriterHotkey);
      setRewriterHotkeyStatus(updatedStatus);
      setRewriterHotkey(updatedStatus.shortcut);

      const current = await loadSharedRewriterSettings();
      await saveSharedRewriterSettings({ ...current, hotkey: updatedStatus.shortcut });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : translate("recording.hotkey.updateError");
      setRewriterHotkeyStatus((currentValue) => ({
        ...(currentValue ?? {
          shortcut: rewriterHotkey,
          isRegistered: false,
          lastError: null,
        }),
        shortcut: rewriterHotkey,
        isRegistered: false,
        lastError: errorMessage,
      }));
    } finally {
      setIsApplyingRewriterHotkey(false);
    }
  }

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
  const rewriterHotkeyBadgeTone = rewriterHotkeyStatus?.isRegistered ? "success" : "error";
  const rewriterHotkeyBadgeLabel = rewriterHotkeyStatus?.isRegistered
    ? t("recording.hotkey.badge.registered")
    : t("recording.hotkey.badge.notRegistered");
  const localizedRewriterHotkeyError = rewriterHotkeyStatus?.lastError
    ? localizeHotkeyError(rewriterHotkeyStatus.lastError)
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
            label={t("rewriter.hotkey.label" as any)}
            description={t("rewriter.hotkey.desc" as any)}
            control={
              <div className="space-y-2">
                <HotkeyInput
                  label={t("rewriter.hotkey.inputLabel" as any)}
                  value={rewriterHotkey}
                  onChange={(value) => setRewriterHotkey(value)}
                  suspendTarget="rewriter"
                />
                <div className="flex items-center justify-between gap-2">
                  <PillBadge tone={rewriterHotkeyBadgeTone}>{rewriterHotkeyBadgeLabel}</PillBadge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleApplyRewriterHotkey()}
                    disabled={isApplyingRewriterHotkey}
                  >
                    {isApplyingRewriterHotkey
                      ? t("recording.hotkey.saving")
                      : t("rewriter.hotkey.apply" as any)}
                  </Button>
                </div>
                {localizedRewriterHotkeyError ? (
                  <Notice tone="error" title={t("recording.hotkey.error.title")}>
                    {localizedRewriterHotkeyError}
                  </Notice>
                ) : null}
              </div>
            }
          />
          <SettingsRow
            label={t("recording.microphone.label")}
            description={t("recording.microphone.desc")}
            control={
              <div className="flex w-full min-w-0 items-center gap-2">
                <Select
                  label={t("recording.microphone.label")}
                  value={microphoneId}
                  onChange={(event) => void handleMicrophoneChange(event.target.value)}
                  options={[
                    { value: "", label: t("recording.microphone.default") },
                    ...microphones.map((mic) => ({ value: mic.deviceId, label: mic.label })),
                  ]}
                  aria-label={t("recording.microphone.label")}
                  className="min-w-0 flex-1 grid-cols-[minmax(0,1fr)]"
                />
                <IconButton
                  icon={<RefreshCw className={isRefreshingMics ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}
                  label={t("recording.microphone.refresh")}
                  onClick={() => void refreshMicrophones()}
                />
              </div>
            }
          />
        </div>
      </SectionCard>
    </div>
  );
}