import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranscriptionHistory } from "../../history/context/TranscriptionHistoryContext";
import { loadSharedTranscriptionSettings } from "../../../lib/sharedState";
import { getProviderPreset } from "../../transcription/config/transcriptionSettings";
import type { RewriterPreset, RewriterSettings } from "../types";

export type RewriterPhase = "idle" | "input" | "processing" | "result";

interface RewriterSessionOptions {
  getLatestRewriterSettings: () => Promise<RewriterSettings>;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized || DEFAULT_BASE_URL;
}

export function useRewriterSession({ getLatestRewriterSettings }: RewriterSessionOptions) {
  const [phase, setPhase] = useState<RewriterPhase>("idle");
  const [selectedText, setSelectedText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [resultText, setResultText] = useState("");
  const [presets, setPresets] = useState<RewriterPreset[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [rewriterModel, setRewriterModel] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const { addHistoryItem, setItemStatus } = useTranscriptionHistory();

  const startSession = useCallback(async (text: string) => {
    try {
      const latestSettings = await getLatestRewriterSettings();
      setPresets(latestSettings.presets.filter((p) => p.isEnabled));
      setSelectedText(text);
      setCustomPrompt("");
      setResultText("");
      setErrorText(null);
      setPhase("input");
    } catch (error) {
      console.error("Failed to start rewriter session:", error);
      setErrorText("Failed to load settings.");
    }
  }, [getLatestRewriterSettings]);

  const abortSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPhase("idle");
    setSelectedText("");
    setCustomPrompt("");
    setResultText("");
    setErrorText(null);
  }, []);

  const sendPrompt = useCallback(async (prompt: string) => {
    if (!prompt.trim() || !selectedText.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setPhase("processing");
    setErrorText(null);

    try {
      const settings = await getLatestRewriterSettings();
      const transcriptionSettings = await loadSharedTranscriptionSettings();
      const customProviders = transcriptionSettings.customProviders ?? [];

      // Resolve API key: rewriter override > custom provider > transcription key
      let apiKey = settings.apiKeyOverride.trim();
      if (!apiKey && settings.provider.startsWith("custom_")) {
        const customId = settings.provider.slice("custom_".length);
        const cp = customProviders.find((c) => c.id === customId);
        if (cp) apiKey = cp.apiKey.trim();
      }
      if (!apiKey) {
        apiKey = transcriptionSettings.apiKey.trim();
      }
      if (!apiKey) {
        throw new Error("API key is missing. Set it in Transcription or Rewriter settings.");
      }

      const model = settings.model || "gpt-4o";

      // Resolve base URL: rewriter override > provider preset > transcription URL > default
      let baseUrl = settings.baseUrlOverride.trim();
      if (!baseUrl) {
        const preset = getProviderPreset(settings.provider, customProviders);
        baseUrl = preset.baseUrl;
      }
      if (!baseUrl) {
        baseUrl = transcriptionSettings.baseUrl.trim();
      }
      const endpoint = `${normalizeBaseUrl(baseUrl)}/chat/completions`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a precise text editor. The user will give you text and an instruction. Apply the instruction to the text and return ONLY the modified text, without any explanation, quotes, or extra formatting.",
            },
            {
              role: "user",
              content: `Text:\n"""${selectedText}"""\n\nInstruction: ${prompt}`,
            },
          ],
          temperature: 0.3,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Unauthorized: Check your API key.");
        if (response.status === 429) throw new Error("Rate limit exceeded.");
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      
      if (!content.trim()) {
        throw new Error("AI returned empty text.");
      }

      setResultText(content.trim());
      setRewriterModel(model);
      setPhase("result");
    } catch (error: any) {
      if (error.name === "AbortError") {
        return; // aborted intentionally
      }
      console.error("Rewriter request failed:", error);
      setErrorText(error.message || "Failed to rewrite text. Check network connection.");
      setPhase("input"); // Go back to input so user can try again
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [getLatestRewriterSettings, selectedText]);

  // Rewrites land in the shared history alongside dictations (kind="rewrite").
  const recordRewriteInHistory = useCallback(
    (status: "inserted" | "copied") => {
      const text = resultText.trim();
      if (!text) return;
      const item = addHistoryItem({
        text,
        provider: "rewriter",
        model: rewriterModel || "gpt-4o",
      });
      setItemStatus(item.id, status);
    },
    [resultText, rewriterModel, addHistoryItem, setItemStatus],
  );

  const insertResult = useCallback(async () => {
    if (!resultText.trim()) return;
    try {
      await invoke("insert_rewritten_text", { text: resultText });
      recordRewriteInHistory("inserted");
      abortSession();
    } catch (error) {
      console.error("Failed to insert rewritten text:", error);
      setErrorText("Insertion failed. Text may be copied to clipboard.");
    }
  }, [resultText, abortSession, recordRewriteInHistory]);

  const rewriteResult = useCallback(() => {
    setSelectedText(resultText);
    setResultText("");
    setCustomPrompt("");
    setErrorText(null);
    setPhase("input");
  }, [resultText]);

  const copyResult = useCallback(async () => {
    if (!resultText.trim()) return;
    try {
      await navigator.clipboard.writeText(resultText);
      recordRewriteInHistory("copied");
      abortSession();
    } catch (error) {
      console.error("Failed to copy text:", error);
      setErrorText("Could not copy to clipboard.");
    }
  }, [resultText, abortSession, recordRewriteInHistory]);

  return {
    phase,
    selectedText,
    customPrompt,
    setCustomPrompt,
    resultText,
    presets,
    errorText,
    startSession,
    abortSession,
    sendPrompt,
    insertResult,
    rewriteResult,
    copyResult,
  };
}
