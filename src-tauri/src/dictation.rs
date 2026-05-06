use std::{
    collections::HashSet,
    sync::{Mutex, MutexGuard},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use tauri::{
    webview::{PageLoadEvent, PageLoadPayload},
    App, AppHandle, Emitter, Manager, PhysicalPosition, Position, Runtime, State, Webview,
    WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::events::{EVENT_DICTATION_ABORT, EVENT_DICTATION_TRIGGERED};

const MAIN_WINDOW_LABEL: &str = "main";
const OVERLAY_WINDOW_LABEL: &str = "overlay";
const OVERLAY_WINDOW_WIDTH: f64 = 304.0;
const OVERLAY_WINDOW_HEIGHT: f64 = 92.0;
const OVERLAY_EDGE_PADDING: i32 = 10;
const PENDING_TRIGGER_TTL: Duration = Duration::from_secs(5);

#[derive(Default)]
pub struct DictationRuntimeStore {
    sequence: Mutex<u64>,
    target: Mutex<CapturedTarget>,
    pending_trigger: Mutex<Option<TriggerContext>>,
    ready_windows: Mutex<HashSet<String>>,
    expected_hide_sequence: Mutex<u64>,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct CapturedTarget {
    pub foreground_hwnd: isize,
    pub focused_hwnd: isize,
    pub captured_at_ms: u64,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationTriggeredPayload {
    pub sequence: u64,
    pub anchor: AnchorPayload,
    pub monitor: MonitorPayload,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnchorPayload {
    pub x: i32,
    pub y: i32,
    pub mode: String,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorPayload {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[derive(Clone)]
struct TriggerContext {
    payload: DictationTriggeredPayload,
    window_x: i32,
    window_y: i32,
    target: CapturedTarget,
    created_at: Instant,
}

pub fn setup<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    app.manage(DictationRuntimeStore::default());
    Ok(())
}

pub fn trigger<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<()> {
    let state = app_handle.state::<DictationRuntimeStore>();
    let trigger_context = build_trigger_context(app_handle, &state)?;
    *lock_recover(&state.pending_trigger) = Some(trigger_context);

    if !is_window_ready(&state, MAIN_WINDOW_LABEL) {
        return Ok(());
    }

    if app_handle.get_webview_window(OVERLAY_WINDOW_LABEL).is_none() {
        mark_window_unready(&state, OVERLAY_WINDOW_LABEL);
    }

    ensure_overlay_window(app_handle)?;
    dispatch_pending_trigger(app_handle, &state)?;
    Ok(())
}

pub fn current_target(state: &DictationRuntimeStore) -> CapturedTarget {
    *lock_recover(&state.target)
}

pub fn clear_target(state: &DictationRuntimeStore) {
    *lock_recover(&state.target) = CapturedTarget::default();
}

pub fn refresh_target_from_foreground(
    state: &DictationRuntimeStore,
    reason: &str,
) -> Option<CapturedTarget> {
    #[cfg(target_os = "windows")]
    {
        let anchor = capture_anchor_from_foreground_window();
        let target = captured_target_from_anchor(&anchor);
        log_target_capture(reason, anchor.mode, target);

        if target.foreground_hwnd == 0 && target.focused_hwnd == 0 {
            return None;
        }

        *lock_recover(&state.target) = target;
        return Some(target);
    }

    #[allow(unreachable_code)]
    None
}

#[tauri::command]
pub fn log_runtime_diagnostic(scope: String, message: String) {
    eprintln!("[vo][{scope}] {message}");
}

pub fn request_abort<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<()> {
    let state = app_handle.state::<DictationRuntimeStore>();
    *lock_recover(&state.pending_trigger) = None;
    *lock_recover(&state.target) = CapturedTarget::default();

    if let Some(overlay) = app_handle.get_webview_window(OVERLAY_WINDOW_LABEL) {
        overlay.emit(EVENT_DICTATION_ABORT, ())?;
    }

    Ok(())
}

#[tauri::command]
pub fn schedule_overlay_hide<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, DictationRuntimeStore>,
    delay_ms: u64,
) {
    let mut expected_seq = lock_recover(&state.expected_hide_sequence);
    *expected_seq += 1;
    let current_seq = *expected_seq;

    tauri::async_runtime::spawn(async move {
        // Run asleeping operation on a blocking thread so we don't block the async executor
        let current_seq_match = tauri::async_runtime::spawn_blocking(move || {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            current_seq
        })
        .await
        .unwrap_or(0);

        let state = app_handle.state::<DictationRuntimeStore>();
        if *lock_recover(&state.expected_hide_sequence) == current_seq_match {
            if let Some(overlay) = app_handle.get_webview_window(OVERLAY_WINDOW_LABEL) {
                let _ = overlay.hide();
            }
        }
    });
}

#[tauri::command]
pub fn cancel_overlay_hide(state: State<'_, DictationRuntimeStore>) {
    *lock_recover(&state.expected_hide_sequence) += 1;
}

#[tauri::command]
pub fn mark_window_ready<R: Runtime>(
    app_handle: AppHandle<R>,
    state: State<'_, DictationRuntimeStore>,
    label: String,
) -> Result<(), String> {
    if label != MAIN_WINDOW_LABEL && label != OVERLAY_WINDOW_LABEL {
        return Err(format!("Unknown window label: {label}"));
    }

    remember_window_ready(&state, label.as_str());

    if label == MAIN_WINDOW_LABEL && lock_recover(&state.pending_trigger).is_some() {
        if app_handle.get_webview_window(OVERLAY_WINDOW_LABEL).is_none() {
            mark_window_unready(&state, OVERLAY_WINDOW_LABEL);
        }
        ensure_overlay_window(&app_handle).map_err(|error| error.to_string())?;
    }

    dispatch_pending_trigger(&app_handle, &state).map_err(|error| error.to_string())
}

pub fn handle_page_load<R: Runtime>(webview: &Webview<R>, payload: &PageLoadPayload<'_>) {
    if payload.event() == PageLoadEvent::Started {
        let state = webview.app_handle().state::<DictationRuntimeStore>();
        mark_window_unready(&state, webview.label());
    }
}

fn ensure_overlay_window<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app_handle.get_webview_window(OVERLAY_WINDOW_LABEL) {
        return Ok(window);
    }

    let overlay = WebviewWindowBuilder::new(
        app_handle,
        OVERLAY_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("Vo Overlay")
    .visible(false)
    .focused(false)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .shadow(false)
    .inner_size(OVERLAY_WINDOW_WIDTH, OVERLAY_WINDOW_HEIGHT)
    .build()?;

    overlay.set_focusable(false)?;
    overlay.set_ignore_cursor_events(false)?;

    Ok(overlay)
}

fn build_trigger_context<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &DictationRuntimeStore,
) -> tauri::Result<TriggerContext> {
    #[cfg(target_os = "windows")]
    {
        let (monitor_position, monitor_size) =
            resolve_monitor_geometry_simple(app_handle);

        // Place overlay at bottom center of the monitor
        let window_x = monitor_position.0
            + (monitor_size.0 as i32 / 2)
            - (OVERLAY_WINDOW_WIDTH as i32 / 2);
        let window_y = monitor_position.1
            + (monitor_size.1 as i32)
            - OVERLAY_EDGE_PADDING
            - OVERLAY_WINDOW_HEIGHT as i32;

        // Capture target window for text insertion
        let anchor = capture_anchor_from_foreground_window();
        let target = captured_target_from_anchor(&anchor);

        return Ok(TriggerContext {
            window_x,
            window_y,
            target,
            payload: DictationTriggeredPayload {
                sequence: next_sequence(state),
                anchor: AnchorPayload {
                    x: window_x,
                    y: window_y,
                    mode: "bottom-center".to_string(),
                },
                monitor: MonitorPayload {
                    x: monitor_position.0,
                    y: monitor_position.1,
                    width: monitor_size.0,
                    height: monitor_size.1,
                    scale_factor: 1.0,
                },
            },
            created_at: Instant::now(),
        });
    }

    #[allow(unreachable_code)]
    Ok(TriggerContext {
        payload: DictationTriggeredPayload {
            sequence: next_sequence(state),
            anchor: AnchorPayload {
                x: 0,
                y: 0,
                mode: "bottom-center".to_string(),
            },
            monitor: MonitorPayload {
                x: 0,
                y: 0,
                width: 1440,
                height: 900,
                scale_factor: 1.0,
            },
        },
        window_x: 540,
        window_y: 800,
        target: CapturedTarget::default(),
        created_at: Instant::now(),
    })
}

fn next_sequence(state: &DictationRuntimeStore) -> u64 {
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

fn dispatch_pending_trigger<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &DictationRuntimeStore,
) -> tauri::Result<()> {
    if !is_window_ready(state, OVERLAY_WINDOW_LABEL) {
        return Ok(());
    }

    let Some(overlay) = app_handle.get_webview_window(OVERLAY_WINDOW_LABEL) else {
        return Ok(());
    };

    let Some(trigger_context) = lock_recover(&state.pending_trigger).take() else {
        return Ok(());
    };

    if trigger_context.created_at.elapsed() > PENDING_TRIGGER_TTL {
        *lock_recover(&state.target) = CapturedTarget::default();
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
            "sequence={} windowPos=({}, {}) target={}",
            trigger_context.payload.sequence,
            trigger_context.window_x,
            trigger_context.window_y,
            describe_target(trigger_context.target)
        ),
    );

    overlay.set_position(Position::Physical(PhysicalPosition::new(
        trigger_context.window_x,
        trigger_context.window_y,
    )))?;
    overlay.show()?;
    overlay.emit(EVENT_DICTATION_TRIGGERED, trigger_context.payload)?;
    Ok(())
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn log_runtime_event(event: &str, detail: String) {
    eprintln!("[vo][dictation][{}] {} {}", current_timestamp_ms(), event, detail);
}

fn describe_target(target: CapturedTarget) -> String {
    format!(
        "foreground=0x{:X} focused=0x{:X} capturedAtMs={}",
        target.foreground_hwnd,
        target.focused_hwnd,
        target.captured_at_ms
    )
}

fn remember_window_ready(state: &DictationRuntimeStore, label: &str) {
    lock_recover(&state.ready_windows).insert(label.to_string());
}

fn mark_window_unready(state: &DictationRuntimeStore, label: &str) {
    lock_recover(&state.ready_windows).remove(label);
}

fn is_window_ready(state: &DictationRuntimeStore, label: &str) -> bool {
    lock_recover(&state.ready_windows).contains(label)
}

#[cfg(target_os = "windows")]
fn monitor_lookup_window<R: Runtime>(app_handle: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app_handle
        .get_webview_window(MAIN_WINDOW_LABEL)
        .or_else(|| app_handle.get_webview_window(OVERLAY_WINDOW_LABEL))
}

#[cfg(target_os = "windows")]
/// Returns (x, y, width, height) of the primary monitor's work area.
fn resolve_monitor_geometry_simple<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> ((i32, i32), (u32, u32)) {
    // Try main window's monitor first
    let monitor = app_handle
        .get_webview_window(MAIN_WINDOW_LABEL)
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| {
            app_handle
                .get_webview_window(OVERLAY_WINDOW_LABEL)
                .and_then(|w| w.current_monitor().ok().flatten())
        });

    if let Some(m) = monitor {
        let wa = m.work_area();
        return ((wa.position.x, wa.position.y), (wa.size.width, wa.size.height));
    }

    // Fallback: use cursor position to find monitor
    let cursor = get_cursor_pos();
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        if let Ok(Some(m)) =
            window.monitor_from_point(cursor.0 as f64, cursor.1 as f64)
        {
            let wa = m.work_area();
            return ((wa.position.x, wa.position.y), (wa.size.width, wa.size.height));
        }
    }

    ((0, 0), (1920, 1080))
}

#[cfg(target_os = "windows")]
struct AnchorSnapshot {
    x: i32,
    y: i32,
    mode: &'static str,
    foreground_hwnd: isize,
    focused_hwnd: isize,
}

#[cfg(target_os = "windows")]
fn captured_target_from_anchor(anchor: &AnchorSnapshot) -> CapturedTarget {
    CapturedTarget {
        foreground_hwnd: anchor.foreground_hwnd,
        focused_hwnd: anchor.focused_hwnd,
        captured_at_ms: current_timestamp_ms(),
    }
}

#[cfg(target_os = "windows")]
fn log_target_capture(reason: &str, mode: &str, target: CapturedTarget) {
    log_runtime_event(
        "target-captured",
        format!("reason={reason} mode={mode} {}", describe_target(target)),
    );
}

#[cfg(target_os = "windows")]
fn get_cursor_pos() -> (i32, i32) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut point) } != 0 {
        (point.x, point.y)
    } else {
        (0, 0)
    }
}

#[cfg(target_os = "windows")]
fn capture_anchor_from_foreground_window() -> AnchorSnapshot {
    use std::mem::size_of;
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        ClientToScreen, GetMonitorInfoW, MonitorFromPoint, MonitorFromWindow, HMONITOR,
        MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetGUIThreadInfo, GetWindowRect, GetWindowThreadProcessId,
        GUITHREADINFO,
    };

    unsafe fn rect_center_top(rect: RECT) -> (i32, i32) {
        ((rect.left + rect.right) / 2, rect.top)
    }

    fn monitor_work_area_from_handle(hmonitor: HMONITOR) -> Option<(i32, i32, u32, u32)> {
        if hmonitor.is_null() {
            return None;
        }

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

        if unsafe { GetMonitorInfoW(hmonitor, &mut monitor_info) } == 0 {
            return None;
        }

        let work_area = monitor_info.rcWork;
        Some((
            work_area.left,
            work_area.top,
            (work_area.right - work_area.left).max(0) as u32,
            (work_area.bottom - work_area.top).max(0) as u32,
        ))
    }

    fn monitor_work_area_from_point(point: POINT) -> Option<(i32, i32, u32, u32)> {
        monitor_work_area_from_handle(unsafe { MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST) })
    }

    fn monitor_work_area_from_window(hwnd: *mut core::ffi::c_void) -> Option<(i32, i32, u32, u32)> {
        if hwnd.is_null() {
            return None;
        }
        monitor_work_area_from_handle(unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) })
    }

    let foreground = unsafe { GetForegroundWindow() };
    if foreground.is_null() {
        return AnchorSnapshot {
            x: 0,
            y: 0,
            mode: "none",
            foreground_hwnd: 0,
            focused_hwnd: 0,
        };
    }

    let thread_id = unsafe { GetWindowThreadProcessId(foreground, std::ptr::null_mut()) };
    let mut focused_hwnd = null_mut();
    if thread_id != 0 {
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

        if unsafe { GetGUIThreadInfo(thread_id, &mut gui_info) } != 0 {
            if !gui_info.hwndFocus.is_null() {
                focused_hwnd = gui_info.hwndFocus;
            }

            if !gui_info.hwndCaret.is_null() {
                let mut top_left = POINT {
                    x: gui_info.rcCaret.left,
                    y: gui_info.rcCaret.top,
                };
                let mut bottom_right = POINT {
                    x: gui_info.rcCaret.right,
                    y: gui_info.rcCaret.bottom,
                };

                unsafe {
                    ClientToScreen(gui_info.hwndCaret, &mut top_left);
                    ClientToScreen(gui_info.hwndCaret, &mut bottom_right);
                }

                let anchor_x = (top_left.x + bottom_right.x) / 2;
                let anchor_y = top_left.y;

                return AnchorSnapshot {
                    x: anchor_x,
                    y: anchor_y,
                    mode: "caret",
                    foreground_hwnd: foreground as isize,
                    focused_hwnd: if !gui_info.hwndFocus.is_null() {
                        gui_info.hwndFocus as isize
                    } else {
                        gui_info.hwndCaret as isize
                    },
                };
            }

            if !gui_info.hwndFocus.is_null() {
                let mut focus_rect = RECT {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                };
                if unsafe { GetWindowRect(gui_info.hwndFocus, &mut focus_rect) } != 0 {
                    let (x, y) = unsafe { rect_center_top(focus_rect) };

                    return AnchorSnapshot {
                        x,
                        y,
                        mode: "focus",
                        foreground_hwnd: foreground as isize,
                        focused_hwnd: gui_info.hwndFocus as isize,
                    };
                }
            }
        }
    }

    let mut window_rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if unsafe { GetWindowRect(foreground, &mut window_rect) } != 0 {
        let (x, y) = unsafe { rect_center_top(window_rect) };

        return AnchorSnapshot {
            x,
            y,
            mode: "window",
            foreground_hwnd: foreground as isize,
            focused_hwnd: focused_hwnd as isize,
        };
    }

    // Last resort: use cursor position
    let cursor = get_cursor_pos();
    AnchorSnapshot {
        x: cursor.0,
        y: cursor.1,
        mode: "cursor",
        foreground_hwnd: foreground as isize,
        focused_hwnd: focused_hwnd as isize,
    }
}
