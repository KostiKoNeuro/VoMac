use std::sync::{Mutex, MutexGuard};

use tauri::{App, AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::{
    dictation,
    events::{EVENT_HOTKEY_STATUS, EVENT_REWRITER_HOTKEY_STATUS},
    rewriter,
    storage,
};

const DEFAULT_DICTATION_SHORTCUT: &str = "Ctrl+Shift+Space";
const DEFAULT_REWRITER_SHORTCUT: &str = "Ctrl+Alt+Space";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyStatusPayload {
    pub shortcut: String,
    pub is_registered: bool,
    pub last_error: Option<String>,
}

pub struct HotkeyStore {
    // Dictation hotkey
    dictation_shortcut: Mutex<String>,
    dictation_registered: Mutex<bool>,
    dictation_error: Mutex<Option<String>>,
    // Rewriter hotkey
    rewriter_shortcut: Mutex<String>,
    rewriter_registered: Mutex<bool>,
    rewriter_error: Mutex<Option<String>>,
}

pub fn setup<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    // Load saved dictation hotkey (or use default)
    let dictation_hotkey = storage::load_current_general_settings(app.handle())
        .map(|s| {
            let saved = s.dictation_hotkey.trim().to_string();
            if saved.is_empty() {
                DEFAULT_DICTATION_SHORTCUT.to_string()
            } else {
                saved
            }
        })
        .unwrap_or_else(|_| DEFAULT_DICTATION_SHORTCUT.to_string());

    // Load saved rewriter hotkey (or use default)
    let rewriter_hotkey = storage::load_current_rewriter_settings(app.handle())
        .map(|s| {
            if s.hotkey.trim().is_empty() {
                DEFAULT_REWRITER_SHORTCUT.to_string()
            } else {
                s.hotkey
            }
        })
        .unwrap_or_else(|_| DEFAULT_REWRITER_SHORTCUT.to_string());

    app.manage(HotkeyStore {
        dictation_shortcut: Mutex::new(dictation_hotkey.clone()),
        dictation_registered: Mutex::new(false),
        dictation_error: Mutex::new(None),
        rewriter_shortcut: Mutex::new(rewriter_hotkey.clone()),
        rewriter_registered: Mutex::new(false),
        rewriter_error: Mutex::new(None),
    });

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app_handle, shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let store = app_handle.state::<HotkeyStore>();

                    if is_shortcut_match(shortcut, &store.dictation_shortcut) {
                        let _ = dictation::trigger(app_handle);
                    } else if is_shortcut_match(shortcut, &store.rewriter_shortcut) {
                        let _ = rewriter::trigger(app_handle);
                    }
                }
            })
            .build(),
    )?;

    let app_handle = app.handle().clone();
    let store = app_handle.state::<HotkeyStore>();

    // Register dictation hotkey
    let status =
        apply_dictation_shortcut(&app_handle, &store, dictation_hotkey);
    let _ = app_handle.emit(EVENT_HOTKEY_STATUS, status);

    // Register rewriter hotkey
    let status = apply_rewriter_shortcut(&app_handle, &store, rewriter_hotkey);
    let _ = app_handle.emit(EVENT_REWRITER_HOTKEY_STATUS, status);

    Ok(())
}

// ─── Dictation hotkey commands ───

#[tauri::command]
pub fn get_hotkey_status(state: State<'_, HotkeyStore>) -> HotkeyStatusPayload {
    dictation_snapshot(&state)
}

#[tauri::command]
pub fn suspend_dictation_hotkey<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, HotkeyStore>,
) -> Result<(), String> {
    let current_shortcut = lock_recover(&state.dictation_shortcut).clone();
    if !current_shortcut.is_empty() && *lock_recover(&state.dictation_registered) {
        let _ = app_handle
            .global_shortcut()
            .unregister(current_shortcut.as_str());
    }
    Ok(())
}

#[tauri::command]
pub fn resume_dictation_hotkey<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, HotkeyStore>,
) -> Result<(), String> {
    let current_shortcut = lock_recover(&state.dictation_shortcut).clone();
    if !current_shortcut.is_empty() && *lock_recover(&state.dictation_registered) {
        let _ = app_handle
            .global_shortcut()
            .register(current_shortcut.as_str());
    }
    Ok(())
}

#[tauri::command]
pub fn set_dictation_hotkey<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, HotkeyStore>,
    shortcut: String,
) -> Result<HotkeyStatusPayload, String> {
    let normalized_shortcut = normalize_shortcut(&shortcut)?;
    let status = apply_dictation_shortcut(&app_handle, &state, normalized_shortcut.clone());
    persist_dictation_shortcut(&app_handle, &normalized_shortcut);
    let _ = app_handle.emit(EVENT_HOTKEY_STATUS, status.clone());
    Ok(status)
}

// Persists the dictation shortcut so setup() can restore it on next launch.
fn persist_dictation_shortcut<R: Runtime>(app_handle: &AppHandle<R>, shortcut: &str) {
    let Ok(mut settings) = storage::load_current_general_settings(app_handle) else {
        return;
    };

    if settings.dictation_hotkey.trim() == shortcut {
        return;
    }

    settings.dictation_hotkey = shortcut.to_string();
    if let Err(error) = storage::save_general_settings(app_handle.clone(), settings) {
        eprintln!("[vo][hotkey] failed to persist dictation shortcut: {error}");
    }
}

// ─── Rewriter hotkey commands ───

#[tauri::command]
pub fn get_rewriter_hotkey_status(state: State<'_, HotkeyStore>) -> HotkeyStatusPayload {
    rewriter_snapshot(&state)
}

#[tauri::command]
pub fn set_rewriter_hotkey<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, HotkeyStore>,
    shortcut: String,
) -> Result<HotkeyStatusPayload, String> {
    let normalized_shortcut = normalize_shortcut(&shortcut)?;
    let status = apply_rewriter_shortcut(&app_handle, &state, normalized_shortcut);
    let _ = app_handle.emit(EVENT_REWRITER_HOTKEY_STATUS, status.clone());
    Ok(status)
}

// ─── Dictation hotkey internals ───

fn apply_dictation_shortcut<R: Runtime>(
    app_handle: &AppHandle<R>,
    store: &HotkeyStore,
    next_shortcut: String,
) -> HotkeyStatusPayload {
    let current_shortcut = lock_recover(&store.dictation_shortcut).clone();
    let shortcuts = app_handle.global_shortcut();

    if current_shortcut == next_shortcut && *lock_recover(&store.dictation_registered) {
        return dictation_snapshot(store);
    }

    if !current_shortcut.is_empty() {
        let _ = shortcuts.unregister(current_shortcut.as_str());
    }

    match shortcuts.register(next_shortcut.as_str()) {
        Ok(_) => {
            *lock_recover(&store.dictation_shortcut) = next_shortcut;
            *lock_recover(&store.dictation_registered) = true;
            *lock_recover(&store.dictation_error) = None;
        }
        Err(error) => {
            *lock_recover(&store.dictation_shortcut) = next_shortcut;
            *lock_recover(&store.dictation_registered) = false;
            *lock_recover(&store.dictation_error) =
                Some(format!("Shortcut registration failed: {error}"));
        }
    }

    dictation_snapshot(store)
}

fn dictation_snapshot(store: &HotkeyStore) -> HotkeyStatusPayload {
    HotkeyStatusPayload {
        shortcut: lock_recover(&store.dictation_shortcut).clone(),
        is_registered: *lock_recover(&store.dictation_registered),
        last_error: lock_recover(&store.dictation_error).clone(),
    }
}

// ─── Rewriter hotkey internals ───

fn apply_rewriter_shortcut<R: Runtime>(
    app_handle: &AppHandle<R>,
    store: &HotkeyStore,
    next_shortcut: String,
) -> HotkeyStatusPayload {
    let current_shortcut = lock_recover(&store.rewriter_shortcut).clone();
    let shortcuts = app_handle.global_shortcut();

    if current_shortcut == next_shortcut && *lock_recover(&store.rewriter_registered) {
        return rewriter_snapshot(store);
    }

    if !current_shortcut.is_empty() {
        let _ = shortcuts.unregister(current_shortcut.as_str());
    }

    match shortcuts.register(next_shortcut.as_str()) {
        Ok(_) => {
            *lock_recover(&store.rewriter_shortcut) = next_shortcut;
            *lock_recover(&store.rewriter_registered) = true;
            *lock_recover(&store.rewriter_error) = None;
        }
        Err(error) => {
            *lock_recover(&store.rewriter_shortcut) = next_shortcut;
            *lock_recover(&store.rewriter_registered) = false;
            *lock_recover(&store.rewriter_error) =
                Some(format!("Shortcut registration failed: {error}"));
        }
    }

    rewriter_snapshot(store)
}

fn rewriter_snapshot(store: &HotkeyStore) -> HotkeyStatusPayload {
    HotkeyStatusPayload {
        shortcut: lock_recover(&store.rewriter_shortcut).clone(),
        is_registered: *lock_recover(&store.rewriter_registered),
        last_error: lock_recover(&store.rewriter_error).clone(),
    }
}

// ─── Shared helpers ───

fn is_shortcut_match(pressed: &Shortcut, stored: &Mutex<String>) -> bool {
    let stored_str = lock_recover(stored);
    if stored_str.is_empty() {
        return false;
    }
    match stored_str.parse::<Shortcut>() {
        Ok(parsed) => *pressed == parsed,
        Err(_) => false,
    }
}

fn normalize_shortcut(input: &str) -> Result<String, String> {
    let normalized = input.trim().replace(' ', "");

    if normalized.is_empty() {
        return Err("Shortcut cannot be empty.".to_string());
    }

    if normalized.len() > 64 {
        return Err("Shortcut is too long.".to_string());
    }

    Ok(normalized)
}

fn lock_recover<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}
