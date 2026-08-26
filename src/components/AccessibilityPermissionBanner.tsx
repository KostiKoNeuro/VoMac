import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../lib/i18n";
import { isApplePlatform } from "../lib/platform";
import { isTauriRuntime } from "../lib/tauri/runtime";
import { Button } from "./ui/Button";

/**
 * macOS-only banner shown while the app lacks Accessibility permission.
 * Without it, synthetic ⌘V/typing events never reach other applications,
 * so both insertion and the rewriter silently do nothing. Re-checks every
 * time the window regains focus (i.e. right after visiting System Settings).
 */
export function AccessibilityPermissionBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime() || !isApplePlatform) {
      return;
    }

    let mounted = true;
    const check = async () => {
      try {
        const granted = await invoke<boolean>("get_accessibility_permission");
        if (mounted) {
          setVisible(!granted);
        }
      } catch {
        // Command unavailable in this runtime — never block the UI.
      }
    };

    void check();
    const handleFocus = () => void check();
    window.addEventListener("focus", handleFocus);
    return () => {
      mounted = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-lg border border-amber-400/30 bg-[#1c1a17]/95 px-4 py-3 shadow-lg backdrop-blur"
      >
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {t("permissions.accessibility.title")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-secondary,inherit)] opacity-80">
            {t("permissions.accessibility.desc")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void invoke("open_accessibility_settings").catch(() => {
                // Best-effort; the user can open System Settings manually.
              });
            }}
          >
            {t("permissions.accessibility.action")}
          </Button>
          <button
            type="button"
            aria-label={t("permissions.accessibility.dismiss")}
            onClick={() => setVisible(false)}
            className="rounded-md p-1 text-[var(--color-text-subtle)] transition-colors hover:bg-white/10 hover:text-[var(--color-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
