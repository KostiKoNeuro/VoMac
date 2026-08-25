import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SectionCard } from "../../components/SectionCard";
import { SettingsRow } from "../../components/SettingsRow";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Notice } from "../../components/ui/Notice";
import { REWRITER_ICONS, getIconEntry, type RewriterIconKey } from "./config/rewriterIcons";
import { loadSharedRewriterSettings, saveSharedRewriterSettings,
  listenForSharedRewriterSettingsSync, loadSharedTranscriptionSettings,
  listenForSharedTranscriptionSettingsSync } from "../../lib/sharedState";
import { defaultRewriterSettings } from "./config/rewriterSettingsStore";
import { buildProviderOptions, getProviderPreset } from "../transcription/config/transcriptionSettings";
import { useTranslation } from "../../lib/i18n";
import { fetchAvailableModels } from "../../lib/modelLoader";
import type { RewriterPreset, RewriterSettings } from "./types";
import type { CustomProviderConfig } from "../transcription/types";
import { cn } from "../../lib/cn";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ── Icon picker for preset editor ── */
function IconPicker({
  value,
  onChange,
}: {
  value: RewriterIconKey;
  onChange: (key: RewriterIconKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = getIconEntry(value);
  const CurrentIcon = current.Icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white/[0.04] text-[var(--color-text-muted)] transition-all hover:border-[var(--color-border-strong)] hover:bg-white/[0.08] hover:text-[var(--color-text-primary)]"
        title="Change icon"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-11 z-20 grid w-[200px] grid-cols-4 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 shadow-[var(--shadow-soft)]">
            {REWRITER_ICONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                title={label}
                onClick={() => { onChange(key); setOpen(false); }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                  value === key
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Prompt editor modal ── */
function PromptModal({
  preset,
  onSave,
  onCancel,
}: {
  preset: RewriterPreset;
  onSave: (prompt: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(preset.prompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  function handleSave() {
    onSave(draft.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onCancel();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleSave();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--color-bg-elevated)] shadow-[var(--shadow-soft)]"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <IconPreview icon={preset.icon} className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {preset.name || t("rewriter.presets.untitled" as any)}
            </p>
            <p className="text-xs text-[var(--color-text-subtle)]">
              {t("rewriter.presets.promptEditor.title" as any)}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-subtle)] transition-all hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Prompt textarea */}
        <div className="p-5">
          <textarea
            ref={textareaRef}
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-white/[0.04] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)]/45 focus:bg-white/[0.06]"
            rows={7}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("rewriter.presets.promptPlaceholder" as any)}
          />
          <p className="mt-2 text-xs text-[var(--color-text-subtle)]">
            {t("rewriter.presets.promptEditor.hint" as any)}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--color-text-primary)]"
          >
            {t("common.cancel" as any)}
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl border border-indigo-200/45 bg-gradient-to-r from-indigo-200 to-violet-300 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[var(--shadow-glow)] transition-all hover:brightness-105 active:brightness-95"
          >
            {t("common.save" as any)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Icon preview (standalone) ── */
function IconPreview({ icon, className }: { icon: RewriterIconKey; className?: string }) {
  const { Icon } = getIconEntry(icon);
  return <Icon className={className} />;
}

/* ── Single preset row ── */
function PresetRow({
  preset,
  onUpdate,
  onDelete,
}: {
  preset: RewriterPreset;
  onUpdate: (field: keyof RewriterPreset, value: string | boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const CurrentIcon = getIconEntry(preset.icon).Icon;

  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <IconPicker
            value={preset.icon}
            onChange={(key) => onUpdate("icon", key)}
          />
          <input
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)]/40 focus:bg-white/[0.05]"
            value={preset.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder={t("rewriter.presets.namePlaceholder" as any)}
          />
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-text-subtle)] transition-all hover:bg-red-500/10 hover:text-red-400"
            onClick={onDelete}
            title={t("rewriter.presets.delete" as any)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
        </div>

        {/* Prompt preview — click to edit */}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-start gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-white/[0.04]"
        >
          <CurrentIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-subtle)]" />
          <span
            className={cn(
              "line-clamp-2 text-sm leading-relaxed",
              preset.prompt
                ? "text-[var(--color-text-muted)]"
                : "text-[var(--color-text-subtle)] italic",
            )}
          >
            {preset.prompt || t("rewriter.presets.promptPlaceholder" as any)}
          </span>
        </button>
      </div>

      {editing && (
        <PromptModal
          preset={preset}
          onSave={(prompt) => { onUpdate("prompt", prompt); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </>
  );
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
  const [customProviders, setCustomProviders] = useState<CustomProviderConfig[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

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

    void listenForSharedRewriterSettingsSync(loadSettings).then((cleanup) => {
      if (!mounted) { cleanup(); return; }
      unlistenRewriter = cleanup;
    });

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
    if (preset.defaultChatModel) setModel(preset.defaultChatModel);
    if (nextProvider.startsWith("custom_")) {
      const customId = nextProvider.slice("custom_".length);
      const cp = customProviders.find((c) => c.id === customId);
      if (cp) setApiKeyOverride(cp.apiKey);
    }
    setAvailableModels([]);
    setModelsError(null);
  }

  async function handleLoadModels() {
    let effectiveKey = apiKeyOverride.trim();
    let effectiveUrl = baseUrlOverride.trim();
    if (!effectiveKey || !effectiveUrl) {
      try {
        const transcriptionSettings = await loadSharedTranscriptionSettings();
        if (!effectiveKey) effectiveKey = transcriptionSettings.apiKey.trim();
        if (!effectiveUrl) effectiveUrl = transcriptionSettings.baseUrl.trim();
      } catch { /* ignore */ }
    }
    if (!effectiveKey) { setModelsError(t("rewriter.models.needKey" as any)); return; }
    if (!effectiveUrl) effectiveUrl = "https://api.openai.com/v1";
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await fetchAvailableModels(effectiveUrl, effectiveKey, "chat");
      setAvailableModels(models);
      if (models.length === 0) setModelsError(t("rewriter.models.noChat" as any));
    } catch (error: any) {
      setModelsError(error.message || t("rewriter.models.loadError" as any));
    } finally {
      setModelsLoading(false);
    }
  }

  async function handleSave() {
    const settings: RewriterSettings = { hotkey, provider, apiKeyOverride, baseUrlOverride, model, presets };
    await saveSharedRewriterSettings(settings);
    setSaveMessage(t("rewriter.saved" as any));
    setTimeout(() => setSaveMessage(null), 3000);
  }

  async function handleReset() {
    // The hotkey is managed in the Recording section now — keep the current
    // value so resetting AI settings never touches the trigger key.
    setProvider(defaultRewriterSettings.provider);
    setApiKeyOverride(defaultRewriterSettings.apiKeyOverride);
    setBaseUrlOverride(defaultRewriterSettings.baseUrlOverride);
    setModel(defaultRewriterSettings.model);
    setPresets([]);
    await saveSharedRewriterSettings({ ...defaultRewriterSettings, hotkey });
    setSaveMessage(t("rewriter.reset.msg" as any));
    setTimeout(() => setSaveMessage(null), 3000);
  }

  function handleAddPreset() {
    const newPreset: RewriterPreset = {
      id: generateId(),
      name: "",
      icon: "sparkles",
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
        <AnimatePresence>
          {saveMessage ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mb-4"
            >
              <Notice tone="success">{saveMessage}</Notice>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="space-y-1">
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
                <div className="flex items-start gap-2">
                  <Input
                    label={t("rewriter.model.inputLabel" as any)}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="gpt-4o"
                    className="min-w-0 flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void handleLoadModels()}
                    disabled={modelsLoading}
                    className="shrink-0 self-end whitespace-nowrap"
                  >
                    {modelsLoading ? t("rewriter.models.loading" as any) : t("rewriter.models.load" as any)}
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
      </SectionCard>

      {/* Presets */}
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
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
            {t("rewriter.presets.empty" as any)}
          </p>
        ) : (
          <div className="space-y-3">
            {presets.map((preset) => (
              <PresetRow
                key={preset.id}
                preset={preset}
                onUpdate={(field, value) => handleUpdatePreset(preset.id, field, value)}
                onDelete={() => handleDeletePreset(preset.id)}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
