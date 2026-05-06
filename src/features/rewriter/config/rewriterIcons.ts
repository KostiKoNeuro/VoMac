import {
  Sparkles,
  Wand2,
  Languages,
  SpellCheck2,
  AlignLeft,
  Highlighter,
  Quote,
  Hash,
  SplitSquareHorizontal,
  Keyboard,
  FileText,
  Zap,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type RewriterIconKey =
  | "sparkles"
  | "wand2"
  | "languages"
  | "spellcheck2"
  | "alignleft"
  | "highlighter"
  | "quote"
  | "hash"
  | "split"
  | "keyboard"
  | "file"
  | "zap";

export interface RewriterIconEntry {
  key: RewriterIconKey;
  label: string;
  Icon: ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>;
}

export const REWRITER_ICONS: RewriterIconEntry[] = [
  { key: "sparkles",    label: "Magic",       Icon: Sparkles },
  { key: "wand2",       label: "Transform",   Icon: Wand2 },
  { key: "languages",   label: "Translate",    Icon: Languages },
  { key: "spellcheck2", label: "Correct",     Icon: SpellCheck2 },
  { key: "alignleft",   label: "Shorten",     Icon: AlignLeft },
  { key: "highlighter", label: "Emphasize",   Icon: Highlighter },
  { key: "quote",       label: "Quote",       Icon: Quote },
  { key: "hash",        label: "Format",      Icon: Hash },
  { key: "split",       label: "Split",       Icon: SplitSquareHorizontal },
  { key: "keyboard",    label: "Rewrite",     Icon: Keyboard },
  { key: "file",        label: "Summarize",   Icon: FileText },
  { key: "zap",         label: "Improve",    Icon: Zap },
];

export const DEFAULT_PRESETS: Array<{
  name: string;
  icon: RewriterIconKey;
  prompt: string;
}> = [
  {
    name: "Improve",
    icon: "zap",
    prompt: "Improve the clarity and fluency of this text without changing its meaning.",
  },
  {
    name: "Shorten",
    icon: "alignleft",
    prompt: "Make this text more concise while preserving the key information.",
  },
  {
    name: "Translate EN",
    icon: "languages",
    prompt: "Translate this text to English.",
  },
  {
    name: "Correct",
    icon: "spellcheck2",
    prompt: "Fix any grammar, spelling, or punctuation errors in this text.",
  },
];

export function getIconEntry(key: RewriterIconKey): RewriterIconEntry {
  return REWRITER_ICONS.find((e) => e.key === key) ?? REWRITER_ICONS[0];
}
