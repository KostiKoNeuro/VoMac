import type { LucideIcon } from "lucide-react";

export type AppSectionId =
  | "general"
  | "recording"
  | "transcription"
  | "rewriter"
  | "history"
  | "about";

export interface AppSection {
  id: AppSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
}
