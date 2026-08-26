use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{
    webview::{PageLoadEvent, PageLoadPayload},
    App, AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Runtime, Size,
    State, Webview, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::dictation::CapturedTarget;
use crate::events::{EVENT_REWRITER_ABORT, EVENT_REWRITER_TRIGGERED};
use crate::insertion::{paste_text_to_target, InsertionResult};

const REWRITER_WINDOW_LABEL: &str = "rewriter";
const REWRITER_WINDOW_WIDTH: f64 = 360.0;
const REWRITER_WINDOW_HEIGHT: f64 = 260.0;
const REWRITER_EDGE_PADDING: i32 = 10;
const PENDING_TRIGGER_TTL: Duration = Duration::from_secs(5);
const CTRL_C_SETTLE_MS: u64 = 150;

#[derive(Default)]
pub struct RewriterRuntimeStore {
    sequence: Mutex<u64>,
    target: Mutex<CapturedTarget>,
    captured_text: Mutex<String>,
    pending_trigger: Mutex<Option<RewriterTriggerContext>>,
    ready: Mutex<bool>,
    expected_hide_sequence: Mutex<u64>,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriterTriggeredPayload {
    pub sequence: u64,
    pub selected_text: String,
}

#[derive(Clone)]
struct RewriterTriggerContext {
    payload: RewriterTriggeredPayload,
    target: CapturedTarget,
    window_x: i32,
    window_y: i32,
    created_at: Instant,
}

pub fn setup<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    app.manage(RewriterRuntimeStore::default());
    Ok(())
}

pub fn handle_page_load<R: Runtime>(webview: &Webview<R>, payload: &PageLoadPayload<'_>) {
    if payload.event() == PageLoadEvent::Started && webview.label() == REWRITER_WINDOW_LABEL {
        let state = webview.app_handle().state::<RewriterRuntimeStore>();
        *lock_recover(&state.ready) = false;
    }
}

pub fn trigger<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<()> {
    let state = app_handle.state::<RewriterRuntimeStore>();

    let trigger_context = build_trigger_context(app_handle, &state)?;

    if trigger_context.payload.selected_text.trim().is_empty() {
        log_runtime_event("trigger-skipped", "no text selected or clipboard empty".to_string());
        return Ok(());
    }

    *lock_recover(&state.pending_trigger) = Some(trigger_context);

    if !*lock_recover(&state.ready) {
        if app_handle.get_webview_window(REWRITER_WINDOW_LABEL).is_none() {
            *lock_recover(&state.ready) = false;
        }
    }

    ensure_rewriter_window(app_handle)?;
    dispatch_pending_trigger(app_handle, &state)?;
    Ok(())
}

pub fn request_abort<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<()> {
    let state = app_handle.state::<RewriterRuntimeStore>();
    *lock_recover(&state.pending_trigger) = None;
    *lock_recover(&state.target) = CapturedTarget::default();
    *lock_recover(&state.captured_text) = String::new();

    if let Some(window) = app_handle.get_webview_window(REWRITER_WINDOW_LABEL) {
        window.emit(EVENT_REWRITER_ABORT, ())?;
    }

    Ok(())
}

#[tauri::command]
pub fn mark_rewriter_ready<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, RewriterRuntimeStore>,
) -> Result<(), String> {
    *lock_recover(&state.ready) = true;

    if lock_recover(&state.pending_trigger).is_some() {
        if app_handle.get_webview_window(REWRITER_WINDOW_LABEL).is_none() {
            *lock_recover(&state.ready) = false;
        }
        ensure_rewriter_window(&app_handle).map_err(|error| error.to_string())?;
    }

    dispatch_pending_trigger(&app_handle, &state).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn schedule_rewriter_hide<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, RewriterRuntimeStore>,
    delay_ms: u64,
) {
    let mut expected_seq = lock_recover(&state.expected_hide_sequence);
    *expected_seq += 1;
    let current_seq = *expected_seq;

    tauri::async_runtime::spawn(async move {
        let current_seq_match = tauri::async_runtime::spawn_blocking(move || {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            current_seq
        })
        .await
        .unwrap_or(0);

        let state = app_handle.state::<RewriterRuntimeStore>();
        if *lock_recover(&state.expected_hide_sequence) == current_seq_match {
            if let Some(window) = app_handle.get_webview_window(REWRITER_WINDOW_LABEL) {
                let _ = window.hide();
            }
        }
    });
}

#[tauri::command]
pub fn cancel_rewriter_hide(state: State<'_, RewriterRuntimeStore>) {
    *lock_recover(&state.expected_hide_sequence) += 1;
}

#[tauri::command]
pub fn insert_rewritten_text(
    state: State<'_, RewriterRuntimeStore>,
    text: String,
) -> InsertionResult {
    let target = *lock_recover(&state.target);
    let result = paste_text_to_target(target, text);
    *lock_recover(&state.target) = CapturedTarget::default();
    *lock_recover(&state.captured_text) = String::new();
    result
}

#[tauri::command]
pub fn get_rewriter_selected_text(state: State<'_, RewriterRuntimeStore>) -> String {
    lock_recover(&state.captured_text).clone()
}

#[tauri::command]
/// Resizes the overlay to hug its content (logical px from the webview),
/// keeping the horizontal center and the top edge, clamped to the monitor.
pub fn resize_rewriter_window<R: Runtime>(
    app_handle: AppHandle<R>,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let Some(window) = app_handle.get_webview_window(REWRITER_WINDOW_LABEL) else {
        return Ok(());
    };

    #[cfg(target_os = "windows")]
    {
        let scale = window.scale_factor().map_err(|error| error.to_string())?;
        let target_w = (width.max(1.0) * scale).round() as i32;
        let target_h = (height.max(1.0) * scale).round() as i32;

        // Decoration-less window: outer and inner sizes match. Skip no-op resizes
        // so the JS ResizeObserver can never ping-pong with this command.
        let current = window.outer_size().map_err(|error| error.to_string())?;
        if (current.width as i32 - target_w).abs() <= 1
            && (current.height as i32 - target_h).abs() <= 1
        {
            return Ok(());
        }

        let old_pos = window.outer_position().map_err(|error| error.to_string())?;
        let ideal_x = old_pos.x + (current.width as i32 - target_w) / 2;
        let ideal_y = old_pos.y;

        let (monitor_pos, monitor_size, _scale) = resolve_monitor_from_point(
            &app_handle,
            old_pos.x + current.width as i32 / 2,
            old_pos.y + current.height as i32 / 2,
        );

        let min_x = monitor_pos.x + REWRITER_EDGE_PADDING;
        let max_x = (monitor_pos.x + monitor_size.width as i32 - target_w
            - REWRITER_EDGE_PADDING)
            .max(min_x);
        let min_y = monitor_pos.y + REWRITER_EDGE_PADDING;
        let max_y = (monitor_pos.y + monitor_size.height as i32 - target_h
            - REWRITER_EDGE_PADDING)
            .max(min_y);

        window
            .set_size(Size::Physical(PhysicalSize::new(
                target_w.max(1) as u32,
                target_h.max(1) as u32,
            )))
            .map_err(|error| error.to_string())?;
        window
            .set_position(Position::Physical(PhysicalPosition::new(
                clamp(ideal_x, min_x, max_x),
                clamp(ideal_y, min_y, max_y),
            )))
            .map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let scale = window.scale_factor().map_err(|error| error.to_string())?;
        let target_w = (width.max(1.0) * scale).round() as i32;
        let target_h = (height.max(1.0) * scale).round() as i32;

        // Skip no-op resizes so the JS ResizeObserver can never ping-pong
        // with this command.
        let current = window.outer_size().map_err(|error| error.to_string())?;
        if (current.width as i32 - target_w).abs() <= 1
            && (current.height as i32 - target_h).abs() <= 1
        {
            return Ok(());
        }

        let old_pos = window.outer_position().map_err(|error| error.to_string())?;
        let ideal_x = old_pos.x + (current.width as i32 - target_w) / 2;
        let ideal_y = old_pos.y;

        // Resolve the containing monitor from the window center expressed in
        // macOS global display coordinates (logical points).
        let center = (
            (old_pos.x + current.width as i32 / 2) as f64 / scale,
            (old_pos.y + current.height as i32 / 2) as f64 / scale,
        );
        let work_area =
            crate::macos_support::monitor_work_area_from_point(&app_handle, center)
                .unwrap_or(((0, 0), (1920, 1080), scale));

        let min_x = work_area.0 .0 + REWRITER_EDGE_PADDING;
        let max_x = (work_area.0 .0 + work_area.1 .0 as i32 - target_w - REWRITER_EDGE_PADDING)
            .max(min_x);
        let min_y = work_area.0 .1 + REWRITER_EDGE_PADDING;
        let max_y = (work_area.0 .1 + work_area.1 .1 as i32 - target_h - REWRITER_EDGE_PADDING)
            .max(min_y);

        window
            .set_size(Size::Physical(PhysicalSize::new(
                target_w.max(1) as u32,
                target_h.max(1) as u32,
            )))
            .map_err(|error| error.to_string())?;
        window
            .set_position(Position::Physical(PhysicalPosition::new(
                clamp(ideal_x, min_x, max_x),
                clamp(ideal_y, min_y, max_y),
            )))
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = (&app_handle, width, height);
    }

    Ok(())
}

fn ensure_rewriter_window<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app_handle.get_webview_window(REWRITER_WINDOW_LABEL) {
        return Ok(window);
    }

    let window = WebviewWindowBuilder::new(
        app_handle,
        REWRITER_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("Vo Rewriter")
    .visible(false)
    .focused(true)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .shadow(false)
    .inner_size(REWRITER_WINDOW_WIDTH, REWRITER_WINDOW_HEIGHT)
    .build()?;

    Ok(window)
}

fn build_trigger_context<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &RewriterRuntimeStore,
) -> tauri::Result<RewriterTriggerContext> {
    #[cfg(target_os = "windows")]
    {
        let (foreground_hwnd, focused_hwnd) = capture_foreground_info();
        let selected_text = capture_selected_text();
        let (cursor_x, cursor_y) = get_cursor_position();
        let (monitor_pos, monitor_size, _scale) =
            resolve_monitor_from_point(app_handle, cursor_x, cursor_y);

        let target = CapturedTarget {
            foreground_hwnd,
            focused_hwnd,
            captured_at_ms: current_timestamp_ms(),
        };

        log_runtime_event(
            "target-captured",
            format!(
                "foreground=0x{:X} focused=0x{:X} textLen={}",
                foreground_hwnd,
                focused_hwnd,
                selected_text.len()
            ),
        );

        *lock_recover(&state.captured_text) = selected_text.clone();

        let ideal_x = cursor_x - (REWRITER_WINDOW_WIDTH as i32 / 2);
        let ideal_y = cursor_y + 20;
        let min_x = monitor_pos.x + REWRITER_EDGE_PADDING;
        let max_x = monitor_pos.x + monitor_size.width as i32
            - REWRITER_WINDOW_WIDTH as i32
            - REWRITER_EDGE_PADDING;
        let min_y = monitor_pos.y + REWRITER_EDGE_PADDING;
        let max_y = monitor_pos.y + monitor_size.height as i32
            - REWRITER_WINDOW_HEIGHT as i32
            - REWRITER_EDGE_PADDING;

        return Ok(RewriterTriggerContext {
            payload: RewriterTriggeredPayload {
                sequence: next_sequence(state),
                selected_text,
            },
            target,
            window_x: clamp(ideal_x, min_x, max_x.max(min_x)),
            window_y: clamp(ideal_y, min_y, max_y.max(min_y)),
            created_at: Instant::now(),
        });
    }

    #[cfg(target_os = "macos")]
    {
        let selected_text = capture_selected_text();

        // macOS global display coordinates are logical points; convert to the
        // containing monitor's physical pixels for the window position.
        let mouse = crate::macos_support::mouse_location();
        let work_area = crate::macos_support::monitor_work_area_from_point(app_handle, mouse)
            .unwrap_or(((0, 0), (1920, 1080), 1.0));
        let scale = work_area.2;
        let cursor_x = (mouse.0 * scale).round() as i32;
        let cursor_y = (mouse.1 * scale).round() as i32;

        log_runtime_event(
            "target-captured",
            format!("textLen={}", selected_text.len()),
        );

        *lock_recover(&state.captured_text) = selected_text.clone();

        let ideal_x = cursor_x - (REWRITER_WINDOW_WIDTH as i32 / 2);
        let ideal_y = cursor_y + 20;
        let min_x = work_area.0 .0 + REWRITER_EDGE_PADDING;
        let max_x = work_area.0 .0 + work_area.1 .0 as i32
            - REWRITER_WINDOW_WIDTH as i32
            - REWRITER_EDGE_PADDING;
        let min_y = work_area.0 .1 + REWRITER_EDGE_PADDING;
        let max_y = work_area.0 .1 + work_area.1 .1 as i32
            - REWRITER_WINDOW_HEIGHT as i32
            - REWRITER_EDGE_PADDING;

        // Remember the frontmost app so it can be re-activated before the
        // rewritten text is pasted back (the overlay steals focus meanwhile).
        let (psn_high, psn_low) = crate::macos_support::front_process_serial();

        return Ok(RewriterTriggerContext {
            payload: RewriterTriggeredPayload {
                sequence: next_sequence(state),
                selected_text,
            },
            target: CapturedTarget {
                foreground_hwnd: psn_high,
                focused_hwnd: psn_low,
                captured_at_ms: current_timestamp_ms(),
            },
            window_x: clamp(ideal_x, min_x, max_x.max(min_x)),
            window_y: clamp(ideal_y, min_y, max_y.max(min_y)),
            created_at: Instant::now(),
        });
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    #[allow(unreachable_code)]
    Ok(RewriterTriggerContext {
        payload: RewriterTriggeredPayload {
            sequence: next_sequence(state),
            selected_text: String::new(),
        },
        target: CapturedTarget::default(),
        window_x: 300,
        window_y: 300,
        created_at: Instant::now(),
    })
}

fn dispatch_pending_trigger<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &RewriterRuntimeStore,
) -> tauri::Result<()> {
    if !*lock_recover(&state.ready) {
        return Ok(());
    }

    let Some(window) = app_handle.get_webview_window(REWRITER_WINDOW_LABEL) else {
        return Ok(());
    };

    let Some(trigger_context) = lock_recover(&state.pending_trigger).take() else {
        return Ok(());
    };

    if trigger_context.created_at.elapsed() > PENDING_TRIGGER_TTL {
        *lock_recover(&state.target) = CapturedTarget::default();
        *lock_recover(&state.captured_text) = String::new();
        log_runtime_event(
            "trigger-expired",
            format!(
                "sequence={} ageMs={}",
                trigger_context.payload.sequence,
                trigger_context.created_at.elapsed().as_millis()
            ),
        );
        return Ok(());
    }

    *lock_recover(&state.target) = trigger_context.target;
    log_runtime_event(
        "trigger-dispatched",
        format!(
            "sequence={} windowPos=({}, {}) textLen={}",
            trigger_context.payload.sequence,
            trigger_context.window_x,
            trigger_context.window_y,
            trigger_context.payload.selected_text.len()
        ),
    );

    window.set_position(Position::Physical(PhysicalPosition::new(
        trigger_context.window_x,
        trigger_context.window_y,
    )))?;
    window.show()?;
    window.set_focus()?;
    window.emit(EVENT_REWRITER_TRIGGERED, trigger_context.payload)?;
    Ok(())
}

fn next_sequence(state: &RewriterRuntimeStore) -> u64 {
    let mut sequence = lock_recover(&state.sequence);
    *sequence += 1;
    *sequence
}

fn clamp(value: i32, min_value: i32, max_value: i32) -> i32 {
    std::cmp::min(max_value, std::cmp::max(min_value, value))
}

fn lock_recover<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn log_runtime_event(event: &str, detail: String) {
    eprintln!(
        "[vo][rewriter][{}] {} {}",
        current_timestamp_ms(),
        event,
        detail
    );
}

// ─── Windows-specific: capture foreground info ───

#[cfg(target_os = "windows")]
fn capture_foreground_info() -> (isize, isize) {
    use std::mem::size_of;
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetGUIThreadInfo, GetWindowThreadProcessId, GUITHREADINFO,
    };

    let foreground = unsafe { GetForegroundWindow() };
    if foreground.is_null() {
        return (0, 0);
    }

    let foreground_hwnd = foreground as isize;
    let thread_id = unsafe { GetWindowThreadProcessId(foreground, std::ptr::null_mut()) };
    if thread_id == 0 {
        return (foreground_hwnd, 0);
    }

    let mut gui_info = GUITHREADINFO {
        cbSize: size_of::<GUITHREADINFO>() as u32,
        flags: 0,
        hwndActive: null_mut(),
        hwndFocus: null_mut(),
        hwndCapture: null_mut(),
        hwndMenuOwner: null_mut(),
        hwndMoveSize: null_mut(),
        hwndCaret: null_mut(),
        rcCaret: RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
    };

    if unsafe { GetGUIThreadInfo(thread_id, &mut gui_info) } != 0 && !gui_info.hwndFocus.is_null()
    {
        return (foreground_hwnd, gui_info.hwndFocus as isize);
    }

    (foreground_hwnd, 0)
}

// ─── Windows-specific: capture selected text via Ctrl+C ───

#[cfg(target_os = "macos")]
fn capture_selected_text() -> String {
    // Prefer the Accessibility API: it reads the selection without touching
    // the clipboard at all. Many native apps (Notes, TextEdit, Xcode,
    // Messages) expose kAXSelectedTextAttribute.
    let ax_text = crate::macos_support::copy_focused_selected_text();
    if !ax_text.trim().is_empty() {
        log_runtime_event(
            "capture-result",
            format!("captured {} chars via accessibility", ax_text.len()),
        );
        return ax_text;
    }

    // Fallback for apps that don't expose the selection (Electron/Chrome):
    // sentinel + ⌘C with the Latin character attached, then restore.
    use arboard::Clipboard;

    let mut clipboard = match Clipboard::new() {
        Ok(cb) => cb,
        Err(error) => {
            log_runtime_event("clipboard-error", format!("Cannot open clipboard: {error}"));
            return String::new();
        }
    };

    let previous_text = clipboard.get_text().ok();

    let sentinel = "\x00__vo_rewriter_sentinel__\x00";
    let _ = clipboard.set_text(sentinel);

    crate::macos_support::send_copy_keystroke();
    std::thread::sleep(std::time::Duration::from_millis(CTRL_C_SETTLE_MS));

    let captured = clipboard.get_text().unwrap_or_default();

    if let Some(prev) = previous_text {
        let _ = clipboard.set_text(prev);
    } else {
        let _ = clipboard.set_text("");
    }

    if captured == sentinel || captured.is_empty() {
        log_runtime_event("capture-result", "no selection detected".to_string());
        return String::new();
    }

    log_runtime_event(
        "capture-result",
        format!("captured {} chars via cmd-c", captured.len()),
    );
    captured
}

#[cfg(target_os = "windows")]
fn capture_selected_text() -> String {
    use arboard::Clipboard;

    let mut clipboard = match Clipboard::new() {
        Ok(cb) => cb,
        Err(error) => {
            log_runtime_event(
                "clipboard-error",
                format!("Cannot open clipboard: {error}"),
            );
            return String::new();
        }
    };

    let previous_text = clipboard.get_text().ok();

    // Set clipboard to a known sentinel so we can detect if Ctrl+C succeeded
    let sentinel = "\x00__vo_rewriter_sentinel__\x00";
    let _ = clipboard.set_text(sentinel);

    send_ctrl_c();
    std::thread::sleep(std::time::Duration::from_millis(CTRL_C_SETTLE_MS));

    let captured = clipboard.get_text().unwrap_or_default();

    // Restore original clipboard
    if let Some(prev) = previous_text {
        let _ = clipboard.set_text(prev);
    } else {
        let _ = clipboard.set_text("");
    }

    if captured == sentinel || captured.is_empty() {
        log_runtime_event("capture-result", "no selection detected".to_string());
        return String::new();
    }

    log_runtime_event(
        "capture-result",
        format!("captured {} chars", captured.len()),
    );
    captured
}

#[cfg(target_os = "windows")]
fn send_ctrl_c() {
    use std::mem::size_of;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        MapVirtualKeyW, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
        MAPVK_VK_TO_VSC, VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN, VK_SPACE, GetAsyncKeyState
    };

    const VK_C: u16 = 0x43;

    fn create_key_input(vk_code: u16, key_up: bool) -> INPUT {
        let scan_code = unsafe { MapVirtualKeyW(vk_code as u32, MAPVK_VK_TO_VSC) as u16 };
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk_code,
                    wScan: scan_code,
                    dwFlags: if key_up { KEYEVENTF_KEYUP } else { 0 },
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    let mut inputs = Vec::new();

    // Release physically pressed keys that might interfere with Ctrl+C (e.g. if triggered by hotkey)
    let keys_to_clear = [VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN, VK_SPACE];
    for &vk in &keys_to_clear {
        if unsafe { GetAsyncKeyState(vk as i32) } & -32768 != 0 {
            inputs.push(create_key_input(vk, true));
        }
    }

    // Ctrl is handled strictly: make sure it is down manually, wait, no, just clear it too
    if unsafe { GetAsyncKeyState(VK_CONTROL as i32) } & -32768 != 0 {
        inputs.push(create_key_input(VK_CONTROL as u16, true));
    }

    // Now send the clean Ctrl + C
    inputs.push(create_key_input(VK_CONTROL as u16, false));
    inputs.push(create_key_input(VK_C, false));
    inputs.push(create_key_input(VK_C, true));
    inputs.push(create_key_input(VK_CONTROL as u16, true));

    unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            size_of::<INPUT>() as i32,
        );
    }
}

// ─── Windows-specific: cursor position ───

#[cfg(target_os = "windows")]
fn get_cursor_position() -> (i32, i32) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut point) } != 0 {
        (point.x, point.y)
    } else {
        (500, 300)
    }
}

// ─── Windows-specific: monitor geometry from point ───

#[cfg(target_os = "windows")]
fn resolve_monitor_from_point<R: Runtime>(
    app_handle: &AppHandle<R>,
    x: i32,
    y: i32,
) -> (
    PhysicalPosition<i32>,
    tauri::PhysicalSize<u32>,
    f64,
) {
    use std::mem::size_of;
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    let point = POINT { x, y };
    let hmonitor = unsafe { MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST) };

    if !hmonitor.is_null() {
        let mut monitor_info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            },
            rcWork: RECT {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            },
            dwFlags: 0,
        };

        if unsafe { GetMonitorInfoW(hmonitor, &mut monitor_info) } != 0 {
            let work = monitor_info.rcWork;
            let scale = app_handle
                .get_webview_window("main")
                .and_then(|w| w.current_monitor().ok().flatten())
                .map(|m| m.scale_factor())
                .unwrap_or(1.0);

            return (
                PhysicalPosition::new(work.left, work.top),
                tauri::PhysicalSize::new(
                    (work.right - work.left).max(0) as u32,
                    (work.bottom - work.top).max(0) as u32,
                ),
                scale,
            );
        }
    }

    (
        PhysicalPosition::new(0, 0),
        tauri::PhysicalSize::new(1920, 1080),
        1.0,
    )
}
