import { translate } from "../../../lib/i18n";

const ASSISTANT_PATTERN =
  /\b(chatgpt|openai|as an ai language model|i can't comply|i cannot comply|large language model)\b/i;

interface QualityGateInput {
  text: string;
  durationMs: number;
}

export interface QualityGateResult {
  allowed: boolean;
  reason?: string;
}

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 0);
}

function hasRepeatedSegments(text: string): boolean {
  const segments = text
    .split(/[.!?\n]+/)
    .map((segment) => segment.trim().toLowerCase())
    .filter((segment) => segment.length >= 18);

  if (segments.length < 6) {
    return false;
  }

  const counts = new Map<string, number>();
  for (const segment of segments) {
    counts.set(segment, (counts.get(segment) ?? 0) + 1);
  }

  return Array.from(counts.values()).some((count) => count >= 3);
}

function hasDominantRepeatedToken(tokens: string[]): boolean {
  if (tokens.length < 30) {
    return false;
  }

  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.length < 3) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  let maxCount = 0;
  for (const count of counts.values()) {
    maxCount = Math.max(maxCount, count);
  }

  return maxCount >= 10 && maxCount / tokens.length >= 0.16;
}

function hasLowUniqueTokenRatio(tokens: string[]): boolean {
  if (tokens.length < 60) {
    return false;
  }

  const uniqueTokens = new Set(tokens);
  return uniqueTokens.size / tokens.length < 0.26;
}

function isDurationMismatch(textLength: number, durationMs: number): boolean {
  const durationSeconds = Math.max(durationMs / 1000, 0.5);
  const charsPerSecond = textLength / durationSeconds;

  if (textLength >= 1200 && charsPerSecond > 45) {
    return true;
  }

  if (textLength >= 320 && durationMs <= 4_000 && charsPerSecond > 60) {
    return true;
  }

  return textLength >= 2_400 && charsPerSecond > 28;
}

export function assessTranscriptionQuality({
  text,
  durationMs,
}: QualityGateInput): QualityGateResult {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return { allowed: false, reason: translate("quality.empty") };
  }

  if (ASSISTANT_PATTERN.test(normalizedText)) {
    return {
      allowed: false,
      reason: translate("quality.assistantText"),
    };
  }

  if (isDurationMismatch(normalizedText.length, durationMs)) {
    return {
      allowed: false,
      reason: translate("quality.durationMismatch"),
    };
  }

  const tokens = tokenize(normalizedText);
  if (hasRepeatedSegments(normalizedText) || hasDominantRepeatedToken(tokens)) {
    return {
      allowed: false,
      reason: translate("quality.repeatedContent"),
    };
  }

  if (hasLowUniqueTokenRatio(tokens)) {
    return {
      allowed: false,
      reason: translate("quality.corrupted"),
    };
  }

  return { allowed: true };
}