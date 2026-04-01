use crate::{
    dictation,
    events::EVENT_SHOW_HISTORY,
    storage,
};
use tauri::menu::{MenuBuilder, MenuItem, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, Runtime, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";
const MAIN_TRAY_ID: &str = "main-tray";
const MENU_OPEN_APP: &str = "open_app";
const MENU_START_DICTATION: &str = "start_dictation";
const MENU_STOP_DICTATION: &str = "stop_dictation";
const MENU_SHOW_HISTORY: &str = "show_history";
const MENU_QUIT: &str = "quit_app";

struct TrayLabels {
    open_app: &'static str,
    start_dictation: &'static str,
    stop_dictation: &'static str,
    show_history: &'static str,
    quit: &'static str,
}

struct TrayMenuHandles<R: Runtime> {
    open_app: MenuItem<R>,
    start_dictation: MenuItem<R>,
    stop_dictation: MenuItem<R>,
    show_history: MenuItem<R>,
    quit: MenuItem<R>,
}

fn tray_labels(language: &str) -> TrayLabels {
    if language == "en" {
        TrayLabels {
            open_app: "Open App",
            start_dictation: "Start Dictation",
            stop_dictation: "Stop Dictation",
            show_history: "Show History",
            quit: "Quit",
        }
    } else {
        TrayLabels {
            open_app: "Открыть приложение",
            start_dictation: "Начать диктовку",
            stop_dictation: "Остановить диктовку",
            show_history: "Показать историю",
            quit: "Выход",
        }
    }
}

pub fn setup<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let language = storage::load_current_general_settings(&app.app_handle())
        .map(|settings| settings.language)
        .unwrap_or_else(|_| "ru".to_string());
    let labels = tray_labels(&language);

    let open_app = MenuItemBuilder::with_id(MENU_OPEN_APP, labels.open_app).build(app)?;
    let start_dictation = MenuItemBuilder::with_id(MENU_START_DICTATION, labels.start_dictation)
        .build(app)?;
    let stop_dictation = MenuItemBuilder::with_id(MENU_STOP_DICTATION, labels.stop_dictation)
        .build(app)?;
    let show_history = MenuItemBuilder::with_id(MENU_SHOW_HISTORY, labels.show_history).build(app)?;
    let quit = MenuItemBuilder::with_id(MENU_QUIT, labels.quit).build(app)?;

    let tray_menu = MenuBuilder::new(app)
        .items(&[
            &open_app,
            &start_dictation,
            &stop_dictation,
            &show_history,
            &quit,
        ])
        .build()?;

    app.manage(TrayMenuHandles {
        open_app: open_app.clone(),
        start_dictation: start_dictation.clone(),
        stop_dictation: stop_dictation.clone(),
        show_history: show_history.clone(),
        quit: quit.clone(),
    });

    let mut tray_builder = TrayIconBuilder::with_id(MAIN_TRAY_ID)
        .menu(&tray_menu)
        .on_menu_event(|app_handle, event| match event.id().as_ref() {
            MENU_OPEN_APP => {
                let _ = show_main_window(app_handle);
            }
            MENU_START_DICTATION => {
                let _ = dictation::trigger(app_handle);
            }
            MENU_STOP_DICTATION => {
                let _ = dictation::request_abort(app_handle);
            }
            MENU_SHOW_HISTORY => {
                let _ = show_main_window(app_handle);
                let _ = app_handle.emit(EVENT_SHOW_HISTORY, ());
            }
            MENU_QUIT => {
                if let Some(overlay) = app_handle.get_webview_window("overlay") {
                    let _ = overlay.destroy();
                }
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = toggle_main_window_visibility(tray.app_handle());
            }
        });

    if let Some(default_icon) = app.default_window_icon().cloned() {
        tray_builder = tray_builder.icon(default_icon);
    }

    tray_builder.build(app)?;
    Ok(())
}

pub fn update_language<R: Runtime>(app_handle: &AppHandle<R>, language: &str) -> tauri::Result<()> {
    let Some(handles) = app_handle.try_state::<TrayMenuHandles<R>>() else {
        return Ok(());
    };

    let labels = tray_labels(language);
    handles.open_app.set_text(labels.open_app)?;
    handles.start_dictation.set_text(labels.start_dictation)?;
    handles.stop_dictation.set_text(labels.stop_dictation)?;
    handles.show_history.set_text(labels.show_history)?;
    handles.quit.set_text(labels.quit)?;

    Ok(())
}

pub fn handle_window_event<R: Runtime>(window: &tauri::Window<R>, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = dictation::request_abort(&window.app_handle());
        if let Some(overlay) = window.app_handle().get_webview_window("overlay") {
            let _ = overlay.destroy();
        }
        let _ = window.hide();
    }
}

fn show_main_window<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }

    Ok(())
}

fn toggle_main_window_visibility<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        if window.is_visible()? {
            window.hide()?;
        } else {
            window.unminimize()?;
            window.show()?;
            window.set_focus()?;
        }
    }

    Ok(())
}