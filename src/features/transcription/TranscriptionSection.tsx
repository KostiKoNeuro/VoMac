import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { SettingsRow } from "../../components/SettingsRow";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Notice } from "../../components/ui/Notice";
import { PillBadge } from "../../components/ui/PillBadge";
import { Select } from "../../components/ui/Select";
import { translate, useTranslation } from "../../lib/i18n";
import {
  languageHintOptions,
  buildProviderOptions,
  getProviderPreset,
} from "./config/transcriptionSettings";
import { useTranscriptionSettings } from "./context/TranscriptionSettingsContext";
import type { CustomProviderConfig } from "./types";
import { fetchAvailableModels } from "../../lib/modelLoader";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function TranscriptionSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useTranscriptionSettings();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [provider, setProvider] = useState(settings.provider);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [modelName, setModelName] = useState(settings.model);
  const [languageHint, setLanguageHint] = useState(settings.languageHint);
  const [customProviders, setCustomProviders] = useState<CustomProviderConfig[]>(
    settings.customProviders ?? [],
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveTone, setSaveTone] = useState<"success" | "warning">("success");

  // Model loading state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(settings.apiKey);
    setProvider(settings.provider);
    setBaseUrl(settings.baseUrl);
    setModelName(settings.model);
    setLanguageHint(settings.languageHint);
    setCustomProviders(settings.customProviders ?? []);
  }, [settings]);

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const preset = getProviderPreset(nextProvider, customProviders);
    setBaseUrl(preset.baseUrl);
    if (preset.defaultSttModel) {
      setModelName(preset.defaultSttModel);
    }
    // If it's a custom provider, auto-fill the API key from custom config
    if (nextProvider.startsWith("custom_")) {
      const customId = nextProvider.slice("custom_".length);
      const cp = customProviders.find((c) => c.id === customId);
      if (cp) {
        setApiKey(cp.apiKey);
      }
    }
    setAvailableModels([]);
    setModelsError(null);
  }

  async function handleLoadModels() {
    if (!apiKey.trim() || !baseUrl.trim()) {
      setModelsError(t("transcription.models.needKey" as any));
      return;
    }

    setModelsLoading(true);
    setModelsError(null);

    try {
      const models = await fetchAvailableModels(baseUrl, apiKey.trim(), "stt");
      setAvailableModels(models);
      if (models.length === 0) {
        setModelsError(t("transcription.models.noStt" as any));
      }
    } catch (error: any) {
      setModelsError(error.message || t("transcription.models.loadError" as any));
    } finally {
      setModelsLoading(false);
    }
  }

  function handleSave() {
    const normalizedApiKey = apiKey.trim();

    // If current provider is custom, also update its stored apiKey
    let updatedCustomProviders = customProviders;
    if (provider.startsWith("custom_")) {
      const customId = provider.slice("custom_".length);
      updatedCustomProviders = customProviders.map((cp) =>
        cp.id === customId ? { ...cp, apiKey: normalizedApiKey, baseUrl: baseUrl.trim() } : cp,
      );
      setCustomProviders(updatedCustomProviders);
    }

    updateSettings({
      provider,
      model: modelName,
      apiKey: normalizedApiKey,
      baseUrl: baseUrl.trim(),
      languageHint: languageHint.trim(),
      customProviders: updatedCustomProviders,
    });
    setSaveTone(normalizedApiKey ? "success" : "warning");
    setSaveMessage(
      normalizedApiKey
        ? translate("transcription.saved")
        : translate("transcription.savedNoKey"),
    );
  }

  // --- Custom provider management ---
  function handleAddCustomProvider() {
    const newProvider: CustomProviderConfig = {
      id: generateId(),
      name: "",
      baseUrl: "",
      apiKey: "",
    };
    setCustomProviders((prev) => [...prev, newProvider]);
  }

  function handleUpdateCustomProvider(
    id: string,
    field: keyof CustomProviderConfig,
    value: string,
  ) {
    setCustomProviders((prev) =>
      prev.map((cp) => (cp.id === id ? { ...cp, [field]: value } : cp)),
    );
  }

  function handleDeleteCustomProvider(id: string) {
    setCustomProviders((prev) => prev.filter((cp) => cp.id !== id));
    // If the deleted provider was selected, switch back to openai
    if (provider === `custom_${id}`) {
      handleProviderChange("openai");
    }
  }

  const preset = getProviderPreset(provider, customProviders);
  const isCustom = provider.startsWith("custom_");
  const providerOptions = buildProviderOptions(customProviders);

  return (
    <div className="grid gap-5">
      <SectionCard
        title={t("transcription.title")}
        description={t("transcription.desc")}
        actions={
          <div className="flex items-center gap-2">
            <PillBadge tone={apiKey.trim() ? "success" : "error"}>
              {apiKey.trim() ? t("transcription.badge.configured") : t("transcription.badge.missing")}
            </PillBadge>
            <Button variant="primary" onClick={handleSave}>
              {t("transcription.save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-1">
          {!preset.sttSupported && !isCustom ? (
            <Notice tone="warning" title={t("transcription.sttNotSupported.title" as any)}>
              {t("transcription.sttNotSupported.body" as any)}
            </Notice>
          ) : null}
          <SettingsRow
            label={t("transcription.provider.label")}
            description={t("transcription.provider.desc")}
            control={
              <Select
                label={t("transcription.provider.inputLabel")}
                value={provider}
                onChange={(event) =>
                  handleProviderChange(event.target.value)
                }
                options={providerOptions}
              />
            }
          />
          <SettingsRow
            label={t("transcription.baseUrl.label" as any)}
            description={t("transcription.baseUrl.desc" as any)}
            control={
              <Input
                label={t("transcription.baseUrl.inputLabel" as any)}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                disabled={!isCustom}
              />
            }
          />
          <SettingsRow
            label={t("transcription.apiKey.label")}
            description={t("transcription.apiKey.desc")}
            control={
              <Input
                type="password"
                label={t("transcription.apiKey.inputLabel")}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={t("transcription.apiKey.placeholder")}
              />
            }
          />
          <SettingsRow
            label={t("transcription.model.label")}
            description={t("transcription.model.desc")}
            control={
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    label={t("transcription.model.inputLabel")}
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    placeholder={preset.defaultSttModel || "model-name"}
                  />
                  {provider !== "deepgram" && (
                    <Button
                      variant="ghost"
                      onClick={() => void handleLoadModels()}
                      disabled={modelsLoading}
                    >
                      {modelsLoading
                        ? t("transcription.models.loading" as any)
                        : t("transcription.models.load" as any)}
                    </Button>
                  )}
                </div>
                {availableModels.length > 0 ? (
                  <div className="mt-1">
                    <Select
                      label="Available Models"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      options={availableModels.map(model => ({ value: model, label: model }))}
                    />
                  </div>
                ) : null}
                {modelsError ? (
                  <p className="text-xs text-[var(--color-text-muted)]">{modelsError}</p>
                ) : null}
              </div>
            }
          />
          <SettingsRow
            label={t("transcription.languageHint.label")}
            description={t("transcription.languageHint.desc")}
            control={
              <Select
                label={t("transcription.languageHint.inputLabel")}
                value={languageHint}
                onChange={(event) => setLanguageHint(event.target.value)}
                options={languageHintOptions}
              />
            }
          />
        </div>
        {saveMessage ? (
          <Notice tone={saveTone} className="mt-4">
            {saveMessage}
          </Notice>
        ) : null}
      </SectionCard>

      {/* Custom Providers Card */}
      <SectionCard
        title={t("transcription.customProviders.title" as any)}
        description={t("transcription.customProviders.desc" as any)}
        actions={
          <Button variant="ghost" onClick={handleAddCustomProvider}>
            {t("transcription.customProviders.add" as any)}
          </Button>
        }
      >
        {customProviders.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            {t("transcription.customProviders.empty" as any)}
          </p>
        ) : (
          <div className="space-y-3">
            {customProviders.map((cp) => (
              <div
                key={cp.id}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none"
                    value={cp.name}
                    onChange={(e) =>
                      handleUpdateCustomProvider(cp.id, "name", e.target.value)
                    }
                    placeholder={t("transcription.customProviders.namePlaceholder" as any)}
                  />
                  <button
                    className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    onClick={() => handleDeleteCustomProvider(cp.id)}
                  >
                    {t("transcription.customProviders.delete" as any)}
                  </button>
                </div>
                <input
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none"
                  value={cp.baseUrl}
                  onChange={(e) =>
                    handleUpdateCustomProvider(cp.id, "baseUrl", e.target.value)
                  }
                  placeholder="https://api.example.com/v1"
                />
                <input
                  type="password"
                  className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2 py-1 text-sm text-[var(--color-text-primary)] outline-none"
                  value={cp.apiKey}
                  onChange={(e) =>
                    handleUpdateCustomProvider(cp.id, "apiKey", e.target.value)
                  }
                  placeholder="sk-..."
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}