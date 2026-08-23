use arboard::Clipboard;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

use crate::dictation::{
    clear_target, current_target, refresh_target_from_foreground, CapturedTarget,
    DictationRuntimeStore,
};

// Give the target app time to read the pasted clipboard content before the
// user's previous clipboard is restored; slow readers need more than a
// moment, but waiting too long risks clobbering a fresh user copy.
const POST_PASTE_CLIPBOARD_SETTLE_MS: u64 = 1500;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsertionResult {
    pub inserted: bool,
    pub method: String,
    pub error: Option<String>,
}

#[tauri::command]
pub fn insert_text_mvp(state: State<'_, DictationRuntimeStore>, text: String) -> InsertionResult {
    #[cfg(target_os = "windows")]
    {
        let shortcut_target = current_target(&state);
        let target = if is_valid_hwnd(shortcut_target.foreground_hwnd)
            || is_valid_hwnd(shortcut_target.focused_hwnd)
        {
            shortcut_target
        } else {
            refresh_target_from_foreground(&state, "before-insertion").unwrap_or(shortcut_target)
        };
        
        log_insertion_event(
            "target-resolved",
            format!(
                "shortcutTarget={} insertionTarget={}",
                describe_target(shortcut_target),
                describe_target(target)
            ),
        );

        let result = paste_text_to_target(target, text);
        clear_target(&state);
        return result;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        InsertionResult {
            inserted: false,
            method: "native_clipboard_paste".to_string(),
            error: Some("System insertion is currently implemented for Windows only.".to_string()),
        }
    }
}

/// Types text directly into whatever input currently has keyboard focus using
/// synthetic Unicode keystrokes (the mechanism Windows' own voice typing uses).
/// Does not touch the clipboard and does not move window focus.
#[tauri::command]
pub fn insert_text_live(text: String) -> InsertionResult {
    #[cfg(target_os = "windows")]
    {
        match type_text_unicode(&text) {
            Ok(()) => {
                log_insertion_event(
                    "live-typed",
                    format!("chars={}", text.chars().count()),
                );
                InsertionResult {
                    inserted: true,
                    method: "unicode_typing".to_string(),
                    error: None,
                }
            }
            Err(error) => {
                log_insertion_event("live-typing-failed", error.clone());
                InsertionResult {
                    inserted: false,
                    method: "unicode_typing".to_string(),
                    error: Some(error),
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        InsertionResult {
            inserted: false,
            method: "unicode_typing".to_string(),
            error: Some("Live typing is currently implemented for Windows only.".to_string()),
        }
    }
}

/// Removes up to `count` characters before the caret with synthetic backspaces.
/// Used to undo live-typed text when the quality gate rejects a dictation.
#[tauri::command]
pub fn delete_last_chars(count: u32) -> InsertionResult {
    #[cfg(target_os = "windows")]
    {
        let capped = count.min(2000);
        match send_backspaces(capped) {
            Ok(()) => InsertionResult {
                inserted: true,
                method: "backspace".to_string(),
                error: None,
            },
            Err(error) => InsertionResult {
                inserted: false,
                method: "backspace".to_string(),
                error: Some(error),
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = count;
        InsertionResult {
            inserted: false,
            method: "backspace".to_string(),
            error: Some("Backspacing is currently implemented for Windows only.".to_string()),
        }
    }
}

#[cfg(target_os = "windows")]
fn type_text_unicode(text: &str) -> Result<(), String> {
    use std::mem::size_of;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    };

    // Newlines rarely survive synthetic typing outside multiline fields; flatten
    // them so streaming chunks behave like continuous speech.
    let normalized: String = text
        .chars()
        .map(|ch| if ch == '\n' || ch == '\r' { ' ' } else { ch })
        .collect();

    // Send UTF-16 units (covers surrogate pairs) in modest batches: some apps
    // drop very large single SendInput arrays.
    let units: Vec<u16> = normalized
        .encode_utf16()
        .filter(|&unit| unit != 0)
        .collect();

    for batch in units.chunks(64) {
        let mut inputs: Vec<INPUT> = Vec::with_capacity(batch.len() * 2);
        for &unit in batch {
            inputs.push(INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0,
                        wScan: unit,
                        dwFlags: KEYEVENTF_UNICODE,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            });
            inputs.push(INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: 0,
                        wScan: unit,
                        dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            });
        }

        let sent =
            unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<INPUT>() as i32) };
        if sent != inputs.len() as u32 {
            return Err("Failed to dispatch Unicode keystrokes.".to_string());
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn send_backspaces(count: u32) -> Result<(), String> {
    use std::mem::size_of;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
    };

    const VK_BACK: u16 = 0x08;

    if count == 0 {
        return Ok(());
    }

    let mut inputs: Vec<INPUT> = Vec::with_capacity((count as usize) * 2);
    for _ in 0..count {
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_BACK,
                    wScan: 0,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VK_BACK,
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }

    let sent = unsafe { SendInput(inputs.len() as u32, inputs.as_ptr(), size_of::<INPUT>() as i32) };
    if sent != inputs.len() as u32 {
        return Err("Failed to dispatch backspaces.".to_string());
    }

    Ok(())
}

pub(crate) fn paste_text_to_target(target: CapturedTarget, text: String) -> InsertionResult {    if text.trim().is_empty() {
        return InsertionResult {
            inserted: false,
            method: "none".to_string(),
            error: Some("Text is empty.".to_string()),
        };
    }

    let mut clipboard = match Clipboard::new() {
        Ok(value) => value,
        Err(error) => {
            return InsertionResult {
                inserted: false,
                method: "native_clipboard_paste".to_string(),
                error: Some(format!("Clipboard unavailable: {error}")),
            };
        }
    };

    let previous_clipboard_text = clipboard.get_text().ok();

    if let Err(error) = clipboard.set_text(text) {
        return InsertionResult {
            inserted: false,
            method: "native_clipboard_paste".to_string(),
            error: Some(format!("Unable to set clipboard text: {error}")),
        };
    }

    #[cfg(target_os = "windows")]
    {
        let insertion_result = try_native_paste(target);
        if insertion_result.is_ok() {
            std::thread::sleep(std::time::Duration::from_millis(
                POST_PASTE_CLIPBOARD_SETTLE_MS,
            ));
        }
        let _ = restore_clipboard(&mut clipboard, previous_clipboard_text);

        match insertion_result {
            Ok(method) => {
                log_insertion_event(
                    "completed",
                    format!("method={method} target={}", describe_target(target)),
                );
                return InsertionResult {
                    inserted: true,
                    method: method.to_string(),
                    error: None,
                };
            }
            Err(error) => {
                log_insertion_event(
                    "failed",
                    format!("target={} error={error}", describe_target(target)),
                );
                return InsertionResult {
                    inserted: false,
                    method: "native_insertion".to_string(),
                    error: Some(error),
                };
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        InsertionResult {
            inserted: false,
            method: "native_clipboard_paste".to_string(),
            error: Some("System insertion is currently implemented for Windows only.".to_string()),
        }
    }
}

#[cfg(target_os = "windows")]
fn is_valid_hwnd(hwnd: isize) -> bool {
    use windows_sys::Win32::UI::WindowsAndMessaging::IsWindow;
    hwnd != 0 && unsafe { IsWindow(hwnd as _) } != 0
}

fn restore_clipboard(
    clipboard: &mut Clipboard,
    previous_clipboard_text: Option<String>,
) -> Result<(), String> {
    if let Some(previous_text) = previous_clipboard_text {
        clipboard
            .set_text(previous_text)
            .map_err(|error| format!("Unable to restore clipboard text: {error}"))?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn try_native_paste(target: CapturedTarget) -> Result<&'static str, String> {
    match send_ctrl_v(target) {
        Ok(_) => {
            log_insertion_event(
                "method-selected",
                format!("method=native_clipboard_paste target={}", describe_target(target)),
            );
            return Ok("native_clipboard_paste");
        }
        Err(error) => {
            log_insertion_event(
                "ctrl-v-failed",
                format!("target={} error={error}", describe_target(target)),
            );
        }
    }

    match try_paste_into_focused_target(target) {
        Ok(method) => {
            log_insertion_event(
                "method-selected",
                format!("method={method} target={}", describe_target(target)),
            );
            Ok(method)
        }
        Err(error) => {
            log_insertion_event(
                "focused-paste-failed",
                format!("target={} error={error}", describe_target(target)),
            );
            Err(error)
        }
    }
}

#[cfg(target_os = "windows")]
fn try_paste_into_focused_target(target: CapturedTarget) -> Result<&'static str, String> {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        IsWindow, SendMessageTimeoutW, SMTO_ABORTIFHUNG, WM_PASTE,
    };

    if target.foreground_hwnd == 0 && target.focused_hwnd == 0 {
        return Err(format!(
            "No captured target was available for insertion{}.",
            format_target_age_suffix(target.captured_at_ms),
        ));
    }

    let focused_hwnd = target.focused_hwnd as HWND;
    if focused_hwnd.is_null() || unsafe { IsWindow(focused_hwnd) } == 0 {
        return Err(format!(
            "No valid focused input target was captured for insertion{}.",
            format_target_age_suffix(target.captured_at_ms),
        ));
    }

    let message_sent = unsafe {
        SendMessageTimeoutW(
            focused_hwnd,
            WM_PASTE,
            0,
            0,
            SMTO_ABORTIFHUNG,
            150,
            std::ptr::null_mut(),
        )
    };

    if message_sent == 0 {
        return Err(format!(
            "Direct paste to the captured input field did not complete{}.",
            format_target_age_suffix(target.captured_at_ms),
        ));
    }

    Ok("native_wm_paste")
}

#[cfg(target_os = "windows")]
fn send_ctrl_v(target: CapturedTarget) -> Result<(), String> {
    use std::{mem::size_of, ptr::null_mut, thread, time::Duration};
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetWindowThreadProcessId, IsIconic, IsWindow, SetForegroundWindow,
        ShowWindow, SW_RESTORE,
    };

    const VK_V: u16 = 0x56;

    fn create_key_input(vk_code: u16, key_up: bool) -> INPUT {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{MapVirtualKeyW, MAPVK_VK_TO_VSC};
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

    let foreground_hwnd = target.foreground_hwnd as HWND;
    let focused_hwnd = target.focused_hwnd as HWND;
    let target_hwnd = if !foreground_hwnd.is_null() && unsafe { IsWindow(foreground_hwnd) } != 0 {
        foreground_hwnd
    } else {
        focused_hwnd
    };

    if target_hwnd.is_null() || unsafe { IsWindow(target_hwnd) } == 0 {
        return Err(format!(
            "No valid target window was captured for insertion{}.",
            format_target_age_suffix(target.captured_at_ms),
        ));
    }

    let current_thread_id = unsafe { GetCurrentThreadId() };
    let target_thread_id = unsafe { GetWindowThreadProcessId(target_hwnd, null_mut()) };
    let attached = if target_thread_id != 0 && target_thread_id != current_thread_id {
        unsafe { AttachThreadInput(current_thread_id, target_thread_id, 1) != 0 }
    } else {
        false
    };

    unsafe {
        if IsIconic(target_hwnd) != 0 {
            ShowWindow(target_hwnd, SW_RESTORE);
        }
        SetForegroundWindow(target_hwnd);
        BringWindowToTop(target_hwnd);
    }

    thread::sleep(Duration::from_millis(150));

    let inputs: [INPUT; 4] = [
        create_key_input(VK_CONTROL as u16, false),
        create_key_input(VK_V, false),
        create_key_input(VK_V, true),
        create_key_input(VK_CONTROL as u16, true),
    ];

    let sent = unsafe {
        SendInput(
            inputs.len() as u32,
            inputs.as_ptr(),
            size_of::<INPUT>() as i32,
        )
    };

    if sent != inputs.len() as u32 {
        if attached {
            unsafe {
                AttachThreadInput(current_thread_id, target_thread_id, 0);
            }
        }
        return Err("Failed to dispatch Ctrl+V key sequence.".to_string());
    }

    thread::sleep(Duration::from_millis(150));

    if attached {
        unsafe {
            AttachThreadInput(current_thread_id, target_thread_id, 0);
        }
    }

    Ok(())
}

fn format_target_age_suffix(captured_at_ms: u64) -> String {
    if captured_at_ms == 0 {
        return String::new();
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(captured_at_ms);

    let age_ms = now_ms.saturating_sub(captured_at_ms);
    format!(" (captured {age_ms} ms ago)")
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn describe_target(target: CapturedTarget) -> String {
    format!(
        "foreground=0x{:X} focused=0x{:X} capturedAtMs={}",
        target.foreground_hwnd,
        target.focused_hwnd,
        target.captured_at_ms
    )
}

fn log_insertion_event(event: &str, detail: String) {
    eprintln!("[vo][insertion][{}] {} {}", current_timestamp_ms(), event, detail);
}
