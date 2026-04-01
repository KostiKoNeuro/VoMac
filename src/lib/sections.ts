import {
  AudioLines,
  Clock3,
  Info,
  PenLine,
  SlidersHorizontal,
  Speech,
} from "lucide-react";
import type { AppSection } from "../types/navigation";

export const appSections: AppSection[] = [
  {
    id: "general",
    label: "nav.general.label",
    description: "nav.general.desc",
    icon: SlidersHorizontal,
  },
  {
    id: "recording",
    label: "nav.recording.label",
    description: "nav.recording.desc",
    icon: AudioLines,
  },
  {
    id: "transcription",
    label: "nav.transcription.label",
    description: "nav.transcription.desc",
    icon: Speech,
  },
  {
    id: "rewriter",
    label: "nav.rewriter.label",
    description: "nav.rewriter.desc",
    icon: PenLine,
  },
  {
    id: "history",
    label: "nav.history.label",
    description: "nav.history.desc",
    icon: Clock3,
  },
  {
    id: "about",
    label: "nav.about.label",
    description: "nav.about.desc",
    icon: Info,
  },
];
