/** True when running in an Apple WebView (macOS dictation host or iOS). */
export function detectApplePlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = `${navigator.userAgent} ${navigator.platform ?? ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(ua);
}

export const isApplePlatform = detectApplePlatform();

/** Canonical shortcut token → display symbol (macOS menu-bar style). */
const MAC_KEY_GLYPHS: Record<string, string> = {
  Command: "⌘",
  Cmd: "⌘",
  Super: "⌘",
  Ctrl: "⌃",
  Control: "⌃",
  Alt: "⌥",
  Option: "⌥",
  Shift: "⇧",
  Enter: "↩",
  Escape: "Esc",
};

/**
 * Formats a stored shortcut string ("Ctrl+Shift+Space") for display:
 * menu-bar glyphs without separators on Apple platforms,
 * "Ctrl + Shift + Space" elsewhere.
 */
export function formatShortcut(shortcut: string): string {
  if (!shortcut) {
    return "";
  }

  const tokens = shortcut
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => MAC_KEY_GLYPHS[token] ?? token);

  return isApplePlatform ? tokens.join("") : tokens.join(" + ");
}
