import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { SettingsRow } from "../../components/SettingsRow";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Notice } from "../../components/ui/Notice";
import {
  loadSharedRewriterSettings,
  saveSharedRewriterSettings,
  listenForSharedRewriterSettingsSync,
  loadSharedTranscriptionSettings,
  listenForSharedTranscriptionSettingsSync,
} from "../../lib/sharedState";
import { defaultRewriterSettings } from "./config/rewriterSettingsStore";
import {
  buildProviderOptions,
  getProviderPreset,
} from "../transcription/config/transcriptionSettings";
import { useTranslation } from "../../lib/i18n";
import { isTauriRuntime } from "../../lib/tauri/runtime";
import { fetchAvailableModels } from "../../lib/modelLoader";
import type { RewriterPreset, RewriterSettings } from "./types";
import type { CustomProviderConfig } from "../transcription/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function RewriterSection() {
  const { t } = useTranslation();
  const [hotkey, setHotkey] = useState(defaultRewriterSettings.hotkey);
  const [provider, setProvider] = useState(defaultRewriterSettings.provider);
  const [apiKeyOverride, setApiKeyOverride] = useState(defaultRewriterSettings.apiKeyOverride);
  const [baseUrlOverride, setBaseUrlOverride] = useState(defaultRewriterSettings.baseUrlOverride);
  const [model, setModel] = useState(defaultRewriterSettings.model);
  const [presets, setPresets] = useState<RewriterPreset[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hotkeyApplying, setHotkeyApplying] = useState(false);

  // Custom providers from transcription settings (shared)
  const [customProviders, setCustomProviders] = useState<CustomProviderConfig[]>([]);

  // Model loading state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Load rewriter settings + custom providers from transcription
  useEffect(() => {
    let mounted = true;
    let unlistenRewriter: (() => void) | null = null;
    let unlistenTranscription: (() => void) | null = null;

    const loadSettings = async () => {
      const current = await loadSharedRewriterSettings();
      const transcription = await loadSharedTranscriptionSettings();
      if (!mounted) return;
      setHotkey(current.hotkey);
      setProvider(current.provider || "openai");
      setApiKeyOverride(current.apiKeyOverride);
      setBaseUrlOverride(current.baseUrlOverride);
      setModel(current.model);
      setPresets(current.presets);
      setCustomProviders(transcription.customProviders ?? []);
    };

    const reloadCustomProviders = async () => {
      const transcription = await loadSharedTranscriptionSettings();
      if (!mounted) return;
      setCustomProviders(transcription.customProviders ?? []);
    };

    void loadSettings();

    // Listen for rewriter settings changes (reloads everything)
    void listenForSharedRewriterSettingsSync(loadSettings).then((cleanup) => {
      if (!mounted) { cleanup(); return; }
      unlistenRewriter = cleanup;
    });

    // Listen for transcription settings changes (refreshes custom providers list)
    void listenForSharedTranscriptionSettingsSync(reloadCustomProviders).then((cleanup) => {
      if (!mounted) { cleanup(); return; }
      unlistenTranscription = cleanup;
    });

    return () => {
      mounted = false;
      unlistenRewriter?.();
      unlistenTranscription?.();
    };
  }, []);

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const preset = getProviderPreset(nextProvider, customProviders);
    setBaseUrlOverride(preset.baseUrl);
    if (preset.defaultChatModel) {
      setModel(preset.defaultChatModel);
    }
    // If custom provider, auto-fill API key
    if (nextProvider.startsWith("custom_")) {
      const customId = nextProvider.slice("custom_".length);
      const cp = customProviders.find((c) => c.id === customId);
      if (cp) {
        setApiKeyOverride(cp.apiKey);
      }
    }
    setAvailableModels([]);
    setModelsError(null);
  }

  async function handleLoadModels() {
    // Resolve effective API key and base URL
    let effectiveKey = apiKeyOverride.trim();
    let effectiveUrl = baseUrlOverride.trim();

    if (!effectiveKey || !effectiveUrl) {
      try {
        const transcriptionSettings = await loadSharedTranscriptionSettings();
        if (!effectiveKey) effectiveKey = transcriptionSettings.apiKey.trim();
        if (!effectiveUrl) effectiveUrl = transcriptionSettings.baseUrl.trim();
      } catch { /* ignore */ }
    }

    if (!effectiveKey) {
      setModelsError(t("rewriter.models.needKey" as any));
      return;
    }

    if (!effectiveUrl) {
      effectiveUrl = "https://api.openai.com/v1";
    }

    setModelsLoading(true);
    setModelsError(null);

    try {
      const models = await fetchAvailableModels(effectiveUrl, effectiveKey, "chat");
      setAvailableModels(models);
      if (models.length === 0) {
        setModelsError(t("rewriter.models.noChat" as any));
      }
    } catch (error: any) {
      setModelsError(error.message || t("rewriter.models.loadError" as any));
    } finally {
      setModelsLoading(false);
    }
  }

  async function handleSave() {
    const settings: RewriterSettings = {
      hotkey,
      provider,
      apiKeyOverride,
      baseUrlOverride,
      model,
      presets,
    };

    await saveSharedRewriterSettings(settings);
    setSaveMessage(t("rewriter.saved" as any));
    setTimeout(() => setSaveMessage(null), 3000);
  }

  async function handleReset() {
    setHotkey(defaultRewriterSettings.hotkey);
    setProvider(defaultRewriterSettings.provider);
    setApiKeyOverride(defaultRewriterSettings.apiKeyOverride);
    setBaseUrlOverride(defaultRewriterSettings.baseUrlOverride);
    setModel(defaultRewriterSettings.model);
    setPresets([]);
    await saveSharedRewriterSettings(defaultRewriterSettings);
    setSaveMessage(t("rewriter.reset.msg" as any));
    setTimeout(() => setSaveMessage(null), 3000);
  }

  async function handleApplyHotkey() {
    if (!isTauriRuntime()) return;
    setHotkeyApplying(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_rewriter_hotkey", { shortcut: hotkey });
    } catch (error) {
      console.error("Failed to apply rewriter hotkey:", error);
    } finally {
      setHotkeyApplying(false);
    }
  }

  function handleAddPreset() {
    const newPreset: RewriterPreset = {
      id: generateId(),
      name: "",
      icon: "✏️",
      prompt: "",
      isEnabled: true,
    };
    setPresets((prev) => [...prev, newPreset]);
  }

  function handleUpdatePreset(id: string, field: keyof RewriterPreset, value: string | boolean) {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }

  function handleDeletePreset(id: string) {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  const providerOptions = buildProviderOptions(customProviders);
  const isCustomProvider = provider.startsWith("custom_");

  return (
    <div className="grid gap-5">
      <SectionCard
        title={t("rewriter.title" as any)}
        description={t("rewriter.desc" as any)}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleReset}>{t("rewriter.reset" as any)}</Button>
            <Button variant="primary" onClick={handleSave}>{t("rewriter.save" as any)}</Button>
          </div>
        }
      >
        <div className="space-y-1">
          <SettingsRow
            label={t("rewriter.hotkey.label" as any)}
            description={t("rewriter.hotkey.desc" as any)}
            control={
              <div className="flex items-center gap-2">
                <Input
                  label={t("rewriter.hotkey.inputLabel" as any)}
                  value={hotkey}
                  onChange={(e) => setHotkey(e.target.value)}
                />
                <Button
                  variant="ghost"
                  onClick={() => void handleApplyHotkey()}
                  disabled={hotkeyApplying}
                >
                  {t("rewriter.hotkey.apply" as any)}
                </Button>
              </div>
            }
          />
          <SettingsRow
            label={t("rewriter.provider.label" as any)}
            description={t("rewriter.provider.desc" as any)}
            control={
              <Select
                label={t("rewriter.provider.inputLabel" as any)}
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                options={providerOptions}
              />
            }
          />
          <SettingsRow
            label={t("rewriter.apiKey.label" as any)}
            description={t("rewriter.apiKey.desc" as any)}
            control={
              <Input
                label={t("rewriter.apiKey.inputLabel" as any)}
                type="password"
                value={apiKeyOverride}
                onChange={(e) => setApiKeyOverride(e.target.value)}
                placeholder={t("rewriter.apiKey.placeholder" as any)}
              />
            }
          />
          <SettingsRow
            label={t("rewriter.baseUrl.label" as any)}
            description={t("rewriter.baseUrl.desc" as any)}
            control={
              <Input
                label={t("rewriter.baseUrl.inputLabel" as any)}
                value={baseUrlOverride}
                onChange={(e) => setBaseUrlOverride(e.target.value)}
                placeholder={t("rewriter.baseUrl.placeholder" as any)}
                disabled={!isCustomProvider}
              />
            }
          />
          <SettingsRow
            label={t("rewriter.model.label" as any)}
            description={t("rewriter.model.desc" as any)}
            control={
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    label={t("rewriter.model.inputLabel" as any)}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gpt-4o"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => void handleLoadModels()}
                    disabled={modelsLoading}
                  >
                    {modelsLoading
                      ? t("rewriter.models.loading" as any)
                      : t("rewriter.models.load" as any)}
                  </Button>
                </div>
                {availableModels.length > 0 ? (
                  <div className="mt-1">
                    <Select
                      label="Available Models"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      options={availableModels.map(m => ({ value: m, label: m }))}
                    />
                  </div>
                ) : null}
                {modelsError ? (
                  <p className="text-xs text-[var(--color-text-muted)]">{modelsError}</p>
                ) : null}
              </div>
            }
          />
        </div>

        {saveMessage ? (
          <Notice tone="success" className="mt-4">
            {saveMessage}
          </Notice>
        ) : null}
      </SectionCard>

      {/* Presets Card */}
      <SectionCard
        title={t("rewriter.presets.title" as any)}
        description={t("rewriter.presets.desc" as any)}
        actions={
          <Button variant="ghost" onClick={handleAddPreset}>
            {t("rewriter.presets.add" as any)}
          </Button>
        }
      >
        {presets.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            {t("rewriter.presets.empty" as any)}
          </p>
        ) : (
          <div className="space-y-3">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="w-10 rounded bg-transparent text-center text-lg outline-none"
                    value={preset.icon}
                    onChange={(e) => handleUpdatePreset(preset.id, "icon", e.target.value)}
                    maxLength={4}
                    title={t("rewriter.presets.icon" as any)}
                  />
                  <input
                    className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none"
                    value={preset.name}
                    onChange={(e) => handleUpdatePreset(preset.id, "name", e.target.value)}
                    placeholder={t("rewriter.presets.namePlaceholder" as any)}
                  />
                  <button
                    className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    onClick={() => handleDeletePreset(preset.id)}
                  >
                    {t("rewriter.presets.delete" as any)}
                  </button>
                </div>
                <textarea
                  className="w-full resize-none rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
                  rows={2}
                  value={preset.prompt}
                  onChange={(e) => handleUpdatePreset(preset.id, "prompt", e.target.value)}
                  placeholder={t("rewriter.presets.promptPlaceholder" as any)}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
