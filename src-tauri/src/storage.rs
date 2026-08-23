use std::{
    fs,
    path::PathBuf,
};

use crate::tray;
use tauri::{AppHandle, Manager, Runtime};

const STORE_FILE_NAME: &str = "vo-store.json";
const MAX_HISTORY_ITEMS: usize = 100;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct TranscriptionSettings {
    pub provider: String,
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub language_hint: String,
    pub custom_providers: Vec<CustomProviderConfig>,
}

impl Default for TranscriptionSettings {
    fn default() -> Self {
        Self {
            provider: "openai".to_string(),
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o-transcribe".to_string(),
            language_hint: String::new(),
            custom_providers: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct GeneralSettings {
    pub profile_name: String,
    pub close_to_tray: bool,
    pub show_notifications: bool,
    pub language: String,
    pub always_copy_to_clipboard: bool,
    pub live_insert: bool,
    /// Saved dictation shortcut; empty means "use the built-in default".
    pub dictation_hotkey: String,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            profile_name: "Personal workstation".to_string(),
            close_to_tray: false,
            show_notifications: true,
            language: "ru".to_string(),
            always_copy_to_clipboard: false,
            live_insert: false,
            dictation_hotkey: String::new(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub text: String,
    pub created_at: i64,
    pub char_length: i64,
    pub word_count: i64,
    pub provider: String,
    pub model: String,
    pub status: String,
    pub inserted_at: Option<i64>,
    pub copied_at: Option<i64>,
    pub failed_at: Option<i64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewriterPreset {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub prompt: String,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RewriterSettings {
    pub hotkey: String,
    pub provider: String,
    pub api_key_override: String,
    pub base_url_override: String,
    pub model: String,
    pub presets: Vec<RewriterPreset>,
}

impl Default for RewriterSettings {
    fn default() -> Self {
        Self {
            hotkey: "Ctrl+Alt+Space".to_string(),
            provider: "openai".to_string(),
            api_key_override: String::new(),
            base_url_override: String::new(),
            model: "gpt-4o".to_string(),
            presets: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct AppStore {
    #[serde(default)]
    general_settings: GeneralSettings,
    #[serde(default)]
    transcription_settings: TranscriptionSettings,
    #[serde(default)]
    rewriter_settings: RewriterSettings,
    #[serde(default)]
    history_items: Vec<HistoryItem>,
}

#[tauri::command]
pub fn load_general_settings<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<GeneralSettings, String> {
    load_current_general_settings(&app_handle)
}

pub fn load_current_general_settings<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<GeneralSettings, String> {
    Ok(read_store(app_handle)?.general_settings)
}

#[tauri::command]
pub fn save_general_settings<R: Runtime>(
    app_handle: AppHandle<R>,
    settings: GeneralSettings,
) -> Result<(), String> {
    let mut store = read_store(&app_handle)?;
    store.general_settings = sanitize_general_settings(settings);
    write_store(&app_handle, &store)?;
    tray::update_language(&app_handle, &store.general_settings.language)
        .map_err(|error| format!("Unable to update tray language: {error}"))
}

#[tauri::command]
pub fn load_transcription_settings<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<TranscriptionSettings, String> {
    Ok(read_store(&app_handle)?.transcription_settings)
}

#[tauri::command]
pub fn save_transcription_settings<R: Runtime>(
    app_handle: AppHandle<R>,
    settings: TranscriptionSettings,
) -> Result<(), String> {
    let mut store = read_store(&app_handle)?;
    store.transcription_settings = sanitize_settings(settings);
    write_store(&app_handle, &store)
}

#[tauri::command]
pub fn load_history_items<R: Runtime>(app_handle: AppHandle<R>) -> Result<Vec<HistoryItem>, String> {
    Ok(read_store(&app_handle)?.history_items)
}

#[tauri::command]
pub fn save_history_items<R: Runtime>(
    app_handle: AppHandle<R>,
    items: Vec<HistoryItem>,
) -> Result<(), String> {
    let mut store = read_store(&app_handle)?;
    store.history_items = sanitize_history(items);
    write_store(&app_handle, &store)
}

#[tauri::command]
pub fn load_rewriter_settings<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<RewriterSettings, String> {
    Ok(read_store(&app_handle)?.rewriter_settings)
}

pub fn load_current_rewriter_settings<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<RewriterSettings, String> {
    Ok(read_store(app_handle)?.rewriter_settings)
}

#[tauri::command]
pub fn save_rewriter_settings<R: Runtime>(
    app_handle: AppHandle<R>,
    settings: RewriterSettings,
) -> Result<(), String> {
    let mut store = read_store(&app_handle)?;
    store.rewriter_settings = sanitize_rewriter_settings(settings);
    write_store(&app_handle, &store)
}

fn sanitize_general_settings(settings: GeneralSettings) -> GeneralSettings {
    GeneralSettings {
        profile_name: settings.profile_name.trim().to_string(),
        close_to_tray: settings.close_to_tray,
        show_notifications: settings.show_notifications,
        language: sanitize_language(settings.language.trim()),
        always_copy_to_clipboard: settings.always_copy_to_clipboard,
        live_insert: settings.live_insert,
        dictation_hotkey: settings.dictation_hotkey.trim().to_string(),
    }
}

fn sanitize_language(lang: &str) -> String {
    if lang == "en" || lang == "ru" {
        lang.to_string()
    } else {
        "ru".to_string()
    }
}

fn sanitize_settings(settings: TranscriptionSettings) -> TranscriptionSettings {
    TranscriptionSettings {
        provider: settings.provider.trim().to_string(),
        api_key: settings.api_key.trim().to_string(),
        base_url: settings.base_url.trim().to_string(),
        model: settings.model.trim().to_string(),
        language_hint: settings.language_hint.trim().to_string(),
        custom_providers: settings
            .custom_providers
            .into_iter()
            .map(|cp| CustomProviderConfig {
                id: cp.id.trim().to_string(),
                name: cp.name.trim().to_string(),
                base_url: cp.base_url.trim().to_string(),
                api_key: cp.api_key.trim().to_string(),
            })
            .collect(),
    }
}

fn sanitize_history(mut items: Vec<HistoryItem>) -> Vec<HistoryItem> {
    items.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    items.truncate(MAX_HISTORY_ITEMS);
    items
}

fn sanitize_rewriter_settings(settings: RewriterSettings) -> RewriterSettings {
    RewriterSettings {
        hotkey: settings.hotkey.trim().to_string(),
        provider: settings.provider.trim().to_string(),
        api_key_override: settings.api_key_override.trim().to_string(),
        base_url_override: settings.base_url_override.trim().to_string(),
        model: settings.model.trim().to_string(),
        presets: settings
            .presets
            .into_iter()
            .map(|preset| RewriterPreset {
                id: preset.id.trim().to_string(),
                name: preset.name.trim().to_string(),
                icon: preset.icon.trim().to_string(),
                prompt: preset.prompt.trim().to_string(),
                is_enabled: preset.is_enabled,
            })
            .collect(),
    }
}

fn store_path<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;

    fs::create_dir_all(&app_dir)
        .map_err(|error| format!("Unable to create app data directory: {error}"))?;

    Ok(app_dir.join(STORE_FILE_NAME))
}

fn read_store<R: Runtime>(app_handle: &AppHandle<R>) -> Result<AppStore, String> {
    let path = store_path(app_handle)?;
    if !path.exists() {
        return Ok(AppStore::default());
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read app storage file: {error}"))?;
    serde_json::from_str::<AppStore>(&contents)
        .map(|mut store| {
            store.general_settings = sanitize_general_settings(store.general_settings.clone());
            store.transcription_settings = sanitize_settings(store.transcription_settings.clone());
            store.rewriter_settings = sanitize_rewriter_settings(store.rewriter_settings.clone());
            store.history_items = sanitize_history(store.history_items);
            store
        })
        .map_err(|error| format!("Unable to parse app storage file: {error}"))
}

fn write_store<R: Runtime>(app_handle: &AppHandle<R>, store: &AppStore) -> Result<(), String> {
    let path = store_path(app_handle)?;
    let serialized = serde_json::to_string_pretty(store)
        .map_err(|error| format!("Unable to serialize app storage: {error}"))?;

    fs::write(path, serialized).map_err(|error| format!("Unable to write app storage: {error}"))
}