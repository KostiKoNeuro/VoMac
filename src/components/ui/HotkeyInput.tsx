import { useEffect, useRef, useState } from "react";
import { X, Keyboard } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTranslation } from "../../lib/i18n";
import { IconButton } from "./IconButton";
import {
  suspendDictationHotkey,
  resumeDictationHotkey,
  suspendRewriterHotkey,
  resumeRewriterHotkey,
} from "../../lib/tauri/hotkey";

interface HotkeyInputProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Which global hotkey to suppress while capturing. Defaults to dictation. */
  suspendTarget?: "dictation" | "rewriter";
}

export function HotkeyInput({
  label,
  hint,
  value,
  onChange,
  className,
  suspendTarget = "dictation",
}: HotkeyInputProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<string[]>([]);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const suspend =
      suspendTarget === "rewriter" ? suspendRewriterHotkey : suspendDictationHotkey;
    const resume =
      suspendTarget === "rewriter" ? resumeRewriterHotkey : resumeDictationHotkey;

    if (!isRecording) {
      setCurrentKeys([]);
      void resume();
      return;
    }

    void suspend();

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const keys = [];
      if (event.ctrlKey) keys.push("Ctrl");
      if (event.shiftKey) keys.push("Shift");
      if (event.altKey) keys.push("Alt");
      if (event.metaKey) keys.push("Super");

      const keyName = event.key;
      const isModifierOnly = ["Control", "Shift", "Alt", "Meta", "Escape", "Enter", "Tab", "CapsLock", "OS"].includes(keyName);

      if (!isModifierOnly && keyName !== " ") {
        const displayKey = keyName.length === 1 ? keyName.toUpperCase() : keyName;
        keys.push(displayKey);
      } else if (keyName === " ") {
        keys.push("Space");
      }

      setCurrentKeys(keys);

      if (keys.length > 0) {
        onChange(keys.join("+"));
        if (!isModifierOnly) {
          setIsRecording(false);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("keyup", handleKeyUp, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [isRecording, onChange, suspendTarget]);

  useEffect(() => {
    if (!isRecording) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (elementRef.current && !elementRef.current.contains(event.target as Node)) {
        setIsRecording(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isRecording]);

  const displayValue = isRecording
    ? (currentKeys.length > 0 ? currentKeys.join(" + ") : t("recording.hotkey.capture.listening"))
    : value;

  return (
    <div className={cn("grid gap-1.5", className)} ref={elementRef}>
      <span className="ui-subtle text-[11px] uppercase tracking-[0.16em]">
        {label}
      </span>
      <div
        className={cn(
          "ui-interactive flex h-10 cursor-text items-center justify-between rounded-[var(--radius-sm)] border px-3 text-sm",
          isRecording
            ? "border-indigo-400/50 bg-indigo-400/10 text-indigo-300 ring-2 ring-indigo-400/20"
            : "border-[var(--color-border)] bg-white/[0.03] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]",
        )}
        onClick={() => setIsRecording(true)}
      >
        <span className={cn(
          "truncate",
          isRecording && currentKeys.length === 0 ? "animate-pulse text-indigo-300/60" : "",
        )}>
          {displayValue}
        </span>
        <div className="ml-2 flex shrink-0 items-center">
          {isRecording ? (
            <IconButton
              icon={<X className="h-3.5 w-3.5" />}
              label={t("recording.hotkey.capture.cancel")}
              onClick={(event) => {
                event.stopPropagation();
                setIsRecording(false);
              }}
              className="h-6 w-6 rounded-md text-indigo-300 hover:bg-indigo-400/20"
            />
          ) : (
            <Keyboard className="h-4 w-4 text-[var(--color-text-subtle)]" />
          )}
        </div>
      </div>
      {hint && !isRecording ? <span className="ui-subtle text-xs">{hint}</span> : null}
      {isRecording ? <span className="text-xs text-indigo-400/80">{t("recording.hotkey.capture.pressHint")}</span> : null}
    </div>
  );
}