mod dictation;
mod events;
mod hotkey;
mod insertion;
mod rewriter;
mod storage;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]), // pass correct args for silent start
        ))
        .on_page_load(|webview, payload| {
            dictation::handle_page_load(webview, payload);
            rewriter::handle_page_load(webview, payload);
        })
        .setup(|app| {
            dictation::setup(app)?;
            rewriter::setup(app)?;
            hotkey::setup(app)?;
            tray::setup(app)?;

            // If launched without --minimized (i.e. normal user launch),
            // show the main window. Autostart passes --minimized so the
            // app starts silently in tray.
            let is_minimized = std::env::args().any(|a| a == "--minimized");
            if !is_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dictation::mark_window_ready,
            dictation::log_runtime_diagnostic,
            dictation::schedule_overlay_hide,
            dictation::cancel_overlay_hide,
            hotkey::get_hotkey_status,
            hotkey::set_dictation_hotkey,
            hotkey::suspend_dictation_hotkey,
            hotkey::resume_dictation_hotkey,
            hotkey::get_rewriter_hotkey_status,
            hotkey::set_rewriter_hotkey,
            insertion::insert_text_mvp,
            storage::load_general_settings,
            storage::save_general_settings,
            storage::load_transcription_settings,
            storage::save_transcription_settings,
            storage::load_history_items,
            storage::save_history_items,
            storage::load_rewriter_settings,
            storage::save_rewriter_settings,
            rewriter::mark_rewriter_ready,
            rewriter::schedule_rewriter_hide,
            rewriter::cancel_rewriter_hide,
            rewriter::insert_rewritten_text,
            rewriter::get_rewriter_selected_text
        ])
        .on_window_event(|window, event| {
            tray::handle_window_event(window, event);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
