//! macOS platform support: layout-independent synthetic keystrokes
//! (paste / live typing / backspaces), Accessibility permission checks,
//! selected-text capture and monitor lookup for overlay placement.
//!
//! Everything here talks to CoreGraphics / CoreFoundation / HIServices through
//! hand-written FFI so no extra crates are needed. The synthetic key events
//! always attach a Latin character via `CGEventKeyboardSetUnicodeString`:
//! with a Cyrillic layout the system translates the physical V/C keycode to
//! "м"/"с", which breaks menu matching for ⌘V/⌘C — the attached character
//! keeps both keycode-driven and character-driven apps working.

#[cfg(target_os = "macos")]
use std::os::raw::c_void;

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

// ─── CoreGraphics / CoreFoundation / HIServices FFI ───

#[cfg(target_os = "macos")]
mod ffi {
    use std::os::raw::c_void;

    pub type CGEventRef = *mut c_void;
    pub type CGEventSourceRef = *mut c_void;
    pub type AXUIElementRef = *mut c_void;
    pub type CFStringRef = *const c_void;

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct CGPoint {
        pub x: f64,
        pub y: f64,
    }

    // kCGEventSourceStateCombinedSessionState: synthetic events behave like real input.
    pub const K_COMBINED_SESSION_STATE: u32 = 1;
    // kCGHIDEventTap: post into the system-wide event stream.
    pub const K_HID_EVENT_TAP: u32 = 0;

    pub const K_EVENT_FLAG_MASK_COMMAND: u64 = 1 << 20;

    // HIToolbox virtual key codes: physical keys, independent of the active layout.
    pub const K_VK_ANSI_C: u16 = 0x08;
    pub const K_VK_ANSI_V: u16 = 0x09;
    pub const K_VK_DELETE: u16 = 0x33;

    pub const K_CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGEventSourceCreate(state_id: u32) -> CGEventSourceRef;
        pub fn CGEventCreateKeyboardEvent(
            source: CGEventSourceRef,
            virtual_key: u16,
            key_down: bool,
        ) -> CGEventRef;
        pub fn CGEventSetFlags(event: CGEventRef, flags: u64);
        pub fn CGEventPost(tap: u32, event: CGEventRef);
        pub fn CGEventKeyboardSetUnicodeString(
            event: CGEventRef,
            string_length: usize,
            string: *const u16,
        );
        pub fn CGEventCreate(source: CGEventSourceRef) -> CGEventRef;
        pub fn CGEventGetLocation(event: CGEventRef) -> CGPoint;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub static kCFBooleanTrue: *const c_void;

        pub fn CFStringCreateWithCString(
            alloc: *const c_void,
            c_str: *const u8,
            encoding: u32,
        ) -> CFStringRef;
        pub fn CFStringGetLength(string: CFStringRef) -> isize;
        pub fn CFStringGetCString(
            string: CFStringRef,
            buffer: *mut u8,
            buffer_size: isize,
            encoding: u32,
        ) -> u8; // Boolean
        pub fn CFDictionaryCreate(
            alloc: *const c_void,
            keys: *const *const c_void,
            values: *const *const c_void,
            num_values: isize,
            key_callbacks: *const c_void,
            value_callbacks: *const c_void,
        ) -> *mut c_void;
        pub fn CFRelease(cf: *const c_void);
    }

    // AX* symbols are exported by the HIServices subumbrella of ApplicationServices.
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        pub static kAXTrustedCheckOptionPrompt: CFStringRef;

        pub fn AXIsProcessTrusted() -> u8; // Boolean
        pub fn AXIsProcessTrustedWithOptions(options: *const c_void) -> u8; // Boolean
        pub fn AXUIElementCreateSystemWide() -> AXUIElementRef;
        pub fn AXUIElementCopyAttributeValue(
            element: AXUIElementRef,
            attribute: CFStringRef,
            value: *mut *mut c_void,
        ) -> i32; // AXError

        // Legacy Carbon process manager: lets us re-activate the previously
        // frontmost app before pasting without pulling in Objective-C.
        pub fn GetFrontProcess(psn: *mut ProcessSerialNumber) -> i32; // OSStatus
        pub fn SetFrontProcess(psn: *const ProcessSerialNumber) -> i32; // OSStatus
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct ProcessSerialNumber {
        pub high: u32,
        pub low: u32,
    }
}

// ─── Accessibility permission ───

/// Whether the user has granted Accessibility access. Synthetic keystrokes and
/// focused-element queries silently fail without it.
#[cfg(target_os = "macos")]
pub fn is_accessibility_granted() -> bool {
    unsafe { ffi::AXIsProcessTrusted() != 0 }
}

/// Triggers the system prompt asking the user to grant Accessibility access.
#[cfg(target_os = "macos")]
pub fn prompt_accessibility_permission() {
    unsafe {
        let keys = [ffi::kAXTrustedCheckOptionPrompt];
        let values = [ffi::kCFBooleanTrue];
        let options = ffi::CFDictionaryCreate(
            std::ptr::null(),
            keys.as_ptr(),
            values.as_ptr(),
            1,
            std::ptr::null(),
            std::ptr::null(),
        );
        if !options.is_null() {
            ffi::AXIsProcessTrustedWithOptions(options);
            ffi::CFRelease(options);
        }
    }
}

#[tauri::command]
pub fn get_accessibility_permission() -> bool {
    #[cfg(target_os = "macos")]
    {
        is_accessibility_granted()
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Other platforms have no Accessibility gate; report as granted so the
        // frontend banner never shows.
        true
    }
}

#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        prompt_accessibility_permission();
        std::process::Command::new("/usr/bin/open")
            .arg(
                "x-apple.systempreferences:com.apple.preference.universal-access?Privacy_Accessibility",
            )
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Failed to open System Settings: {error}"))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Accessibility settings only exist on macOS.".to_string())
    }
}

// ─── Synthetic keystrokes ───

#[cfg(target_os = "macos")]
struct EventSession(ffi::CGEventSourceRef);

#[cfg(target_os = "macos")]
impl EventSession {
    fn new() -> Self {
        EventSession(unsafe { ffi::CGEventSourceCreate(ffi::K_COMBINED_SESSION_STATE) })
    }
}

#[cfg(target_os = "macos")]
impl Drop for EventSession {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { ffi::CFRelease(self.0) };
        }
    }
}

#[cfg(target_os = "macos")]
fn post_key_event(
    source: ffi::CGEventSourceRef,
    virtual_key: u16,
    key_down: bool,
    flags: u64,
    unicode_payload: Option<&str>,
) -> bool {
    unsafe {
        let event = ffi::CGEventCreateKeyboardEvent(source, virtual_key, key_down);
        if event.is_null() {
            return false;
        }
        if flags != 0 {
            ffi::CGEventSetFlags(event, flags);
        }
        if let Some(payload) = unicode_payload {
            let units: Vec<u16> = payload.encode_utf16().collect();
            ffi::CGEventKeyboardSetUnicodeString(event, units.len(), units.as_ptr());
        }
        ffi::CGEventPost(ffi::K_HID_EVENT_TAP, event);
        ffi::CFRelease(event);
        true
    }
}

/// Sends ⌘V using the physical V keycode plus an attached "v" character, so
/// the paste command is recognized regardless of the active keyboard layout.
#[cfg(target_os = "macos")]
pub fn send_paste_keystroke() -> Result<(), String> {
    let session = EventSession::new();
    let flags = ffi::K_EVENT_FLAG_MASK_COMMAND;
    if post_key_event(session.0, ffi::K_VK_ANSI_V, true, flags, Some("v"))
        && post_key_event(session.0, ffi::K_VK_ANSI_V, false, flags, Some("v"))
    {
        Ok(())
    } else {
        Err("Failed to dispatch the ⌘V keystrokes.".to_string())
    }
}

/// Sends ⌘C the same layout-proof way (rewriter selection fallback).
#[cfg(target_os = "macos")]
pub fn send_copy_keystroke() {
    let session = EventSession::new();
    let flags = ffi::K_EVENT_FLAG_MASK_COMMAND;
    post_key_event(session.0, ffi::K_VK_ANSI_C, true, flags, Some("c"));
    post_key_event(session.0, ffi::K_VK_ANSI_C, false, flags, Some("c"));
}

/// Types text directly into whatever input currently has keyboard focus using
/// synthetic Unicode keystrokes. Each event carries its own Unicode payload,
/// making this fully independent of the active keyboard layout. Newlines are
/// flattened to spaces to match the Windows streaming behavior.
#[cfg(target_os = "macos")]
pub fn type_text_unicode(text: &str) -> Result<(), String> {
    let normalized: String = text
        .chars()
        .map(|ch| if ch == '\n' || ch == '\r' { ' ' } else { ch })
        .collect();

    let session = EventSession::new();

    for ch in normalized.chars().filter(|ch| *ch != '\0') {
        // str::encode_utf16 yields an iterator; char's own encode_utf16 is
        // the buffer-filling variant, hence the round-trip through String.
        let units: Vec<u16> = ch.to_string().encode_utf16().collect();
        for &key_down in &[true, false] {
            unsafe {
                // Keycode 0 is a placeholder; apps read the attached Unicode
                // payload instead of the keycode for these events.
                let event = ffi::CGEventCreateKeyboardEvent(session.0, 0, key_down);
                if event.is_null() {
                    return Err("Failed to create a Unicode keystroke event.".to_string());
                }
                ffi::CGEventKeyboardSetUnicodeString(event, units.len(), units.as_ptr());
                ffi::CGEventPost(ffi::K_HID_EVENT_TAP, event);
                ffi::CFRelease(event);
            }
        }
    }

    Ok(())
}

/// Removes up to `count` characters before the caret with synthetic deletes.
#[cfg(target_os = "macos")]
pub fn send_backspaces(count: u32) -> Result<(), String> {
    if count == 0 {
        return Ok(());
    }

    let session = EventSession::new();
    for _ in 0..count {
        post_key_event(session.0, ffi::K_VK_DELETE, true, 0, None);
        post_key_event(session.0, ffi::K_VK_DELETE, false, 0, None);
    }

    Ok(())
}

// ─── Selected-text capture (Accessibility) ───

#[cfg(target_os = "macos")]
fn cf_string_to_rust(cf_string: ffi::CFStringRef) -> String {
    if cf_string.is_null() {
        return String::new();
    }

    unsafe {
        let length = ffi::CFStringGetLength(cf_string).max(0) as usize;
        // Worst case per UTF-16 unit is 3 UTF-8 bytes (surrogate pairs are 2
        // units for 4 bytes), plus the NUL terminator CFStringGetCString adds.
        let mut buffer = vec![0u8; length * 3 + 1];
        let size = buffer.len() as isize;
        if ffi::CFStringGetCString(cf_string, buffer.as_mut_ptr(), size, ffi::K_CF_STRING_ENCODING_UTF8)
            != 0
        {
            let end = buffer
                .iter()
                .position(|&byte| byte == 0)
                .unwrap_or(buffer.len());
            String::from_utf8_lossy(&buffer[..end]).into_owned()
        } else {
            String::new()
        }
    }
}

// AXAttributeConstants.h declares attribute names as CFSTR() macros rather
// than exported symbols (they have no linker presence), so build the matching
// CFStrings ourselves.
#[cfg(target_os = "macos")]
fn ax_attribute_name(name: &str) -> ffi::CFStringRef {
    let mut bytes = name.as_bytes().to_vec();
    bytes.push(0);
    unsafe {
        ffi::CFStringCreateWithCString(
            std::ptr::null(),
            bytes.as_ptr(),
            ffi::K_CF_STRING_ENCODING_UTF8,
        )
    }
}

/// Returns the selected text of the focused UI element via the Accessibility
/// API, or an empty string when the app does not expose it (common in
/// Electron/Chrome). Does not touch the clipboard.
#[cfg(target_os = "macos")]
pub fn copy_focused_selected_text() -> String {
    unsafe {
        let system_wide = ffi::AXUIElementCreateSystemWide();
        if system_wide.is_null() {
            return String::new();
        }

        let focused_attr = ax_attribute_name("AXFocusedUIElement");
        let mut focused: *mut c_void = std::ptr::null_mut();
        let error = ffi::AXUIElementCopyAttributeValue(system_wide, focused_attr, &mut focused);
        ffi::CFRelease(focused_attr);
        ffi::CFRelease(system_wide);
        if error != 0 || focused.is_null() {
            return String::new();
        }

        let selected_attr = ax_attribute_name("AXSelectedText");
        let mut value: *mut c_void = std::ptr::null_mut();
        let error = ffi::AXUIElementCopyAttributeValue(focused, selected_attr, &mut value);
        ffi::CFRelease(selected_attr);
        ffi::CFRelease(focused);
        if error != 0 || value.is_null() {
            return String::new();
        }

        let text = cf_string_to_rust(value as ffi::CFStringRef);
        ffi::CFRelease(value);
        text
    }
}

// ─── Frontmost-app bookkeeping ───

// The rewriter overlay takes keyboard focus on macOS (it has a prompt input),
// so before pasting we hand focus back to the app captured at trigger time.
// The ProcessSerialNumber halves are stashed inside CapturedTarget's unused
// hwnd fields.

/// Serial number `(high, low)` of the current frontmost app, or `(0, 0)` when
/// unavailable. Zeros mean "skip reactivation".
#[cfg(target_os = "macos")]
pub fn front_process_serial() -> (isize, isize) {
    unsafe {
        let mut psn = ffi::ProcessSerialNumber { high: 0, low: 0 };
        if ffi::GetFrontProcess(&mut psn) == 0 && !(psn.high == 0 && psn.low == 0) {
            (psn.high as isize, psn.low as isize)
        } else {
            (0, 0)
        }
    }
}

/// Brings the app with the given serial number back to the front.
#[cfg(target_os = "macos")]
pub fn activate_front_process(serial: (isize, isize)) -> bool {
    let psn = ffi::ProcessSerialNumber {
        high: serial.0 as u32,
        low: serial.1 as u32,
    };
    unsafe { ffi::SetFrontProcess(&psn) == 0 }
}

// ─── Cursor location and monitors ───

/// Current mouse position in macOS global display coordinates (points,
/// top-left origin across all displays).
#[cfg(target_os = "macos")]
pub fn mouse_location() -> (f64, f64) {
    unsafe {
        let event = ffi::CGEventCreate(std::ptr::null_mut());
        if event.is_null() {
            return (0.0, 0.0);
        }
        let point = ffi::CGEventGetLocation(event);
        ffi::CFRelease(event);
        (point.x, point.y)
    }
}

/// Physical work area `(position, size, scale_factor)` of the monitor that
/// contains the given point in global display coordinates. Monitor geometry
/// from Tauri is in physical pixels, so bounds are compared in logical points.
#[cfg(target_os = "macos")]
pub type MacMonitorWorkArea = ((i32, i32), (u32, u32), f64);

#[cfg(target_os = "macos")]
fn any_app_window<R: Runtime>(app_handle: &AppHandle<R>) -> Option<WebviewWindow<R>> {
    app_handle
        .get_webview_window("main")
        .or_else(|| app_handle.get_webview_window("overlay"))
        .or_else(|| app_handle.get_webview_window("rewriter"))
}

#[cfg(target_os = "macos")]
pub fn monitor_work_area_from_point<R: Runtime>(
    app_handle: &AppHandle<R>,
    point: (f64, f64),
) -> Option<MacMonitorWorkArea> {
    let window = any_app_window(app_handle)?;
    let monitors = window.available_monitors().ok()?;

    for monitor in monitors {
        let scale = monitor.scale_factor();
        let position = monitor.position();
        let size = monitor.size();

        let logical_x = position.x as f64 / scale;
        let logical_y = position.y as f64 / scale;
        let logical_w = size.width as f64 / scale;
        let logical_h = size.height as f64 / scale;

        if point.0 >= logical_x
            && point.0 < logical_x + logical_w
            && point.1 >= logical_y
            && point.1 < logical_y + logical_h
        {
            return Some(((position.x, position.y), (size.width, size.height), scale));
        }
    }

    None
}
