# Project rules

This is a Windows-first desktop dictation app built with Tauri v2 + React + TypeScript.

## Product behavior
- The app records speech from a floating pill overlay.
- After transcription, text should be inserted into the currently active input field.
- If insertion fails, clipboard fallback is allowed, but only as a fallback.
- After successful insertion, the floating pill must disappear automatically.
- When the app exits, all windows including overlay must close.
- Overlay should use only the compact pill layout area, not a large panel.

## Engineering rules
- Make minimal, high-confidence changes.
- Fix one bug at a time.
- Before editing, inspect the current flow and identify root cause.
- Do not refactor unrelated files.
- Preserve existing architecture unless a small structural fix is required.
- After changes, run the app or relevant checks.
- Report:
  1. root cause
  2. changed files
  3. what was fixed
  4. what remains unverified

## UX rules
- Overlay should be compact and minimal.
- The active visual area should only be the pill content region.
- Prefer stable Windows behavior over clever but fragile behavior.