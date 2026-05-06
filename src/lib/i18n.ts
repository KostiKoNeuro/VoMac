import { useCallback, useSyncExternalStore } from "react";
import { loadSharedGeneralSettings, listenForSharedGeneralSettingsSync } from "./sharedState";

export type AppLanguage = "en" | "ru";

const en = {
  "vo.title": "Dicta",
  "vo.subtitle": "Windows Dictation",
  "common.logoAlt": "Dicta logo",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.language.en": "English",
  "common.language.ru": "Русский",

  "nav.general.label": "General",
  "nav.general.desc": "App behavior and shell",
  "nav.recording.label": "Recording",
  "nav.recording.desc": "Mic flow and hotkey profile",
  "nav.transcription.label": "Transcription",
  "nav.transcription.desc": "Model and text formatting",
  "nav.history.label": "History",
  "nav.history.desc": "Recent dictation activity",
  "nav.about.label": "About",
  "nav.about.desc": "Product overview",

  "shell.title": "Product shell",

  "about.title": "About Dicta",
  "about.desc": "System-wide voice dictation for Windows with an overlay-driven transcription flow.",
  "about.version": "Version 0.1.0-beta",
  "about.badge": "Beta Release",
  "about.dev.label": "Developed by",
  "about.dev.name": "KostiKo / Botanutyi Kostya",
  "about.telegram": "Telegram",
  "about.blurb": "Dicta is a clean, minimal dictation overlay designed specifically for Windows. Press the global hotkey anywhere, speak, and insert text directly into any application.",

  "general.title": "General",
  "general.desc": "Core desktop behavior and default shell preferences.",
  "general.reset": "Reset",
  "general.save": "Save Changes",
  "general.profile.label": "Profile label",
  "general.profile.desc": "Friendly name used for this machine and future sync.",
  "general.profile.inputLabel": "Profile",
  "general.autostart.label": "Start with Windows",
  "general.autostart.desc": "Automatically launch Dicta when your session starts.",
  "general.autostart.aria": "Enable start with Windows",
  "general.tray.label": "Close to tray",
  "general.tray.desc": "Keep the app running in the background when closed.",
  "general.tray.aria": "Enable close to tray",
  "general.notifications.label": "Desktop notifications",
  "general.notifications.desc": "Show compact status notifications for dictation events.",
  "general.notifications.aria": "Enable desktop notifications",
  "general.language.label": "Language",
  "general.language.desc": "Display language for the application interface.",
  "general.language.selectAria": "Select interface language",
  "general.saved": "General settings saved.",
  "general.reset.msg": "General settings reset to defaults.",
  "general.clipboard.label": "Copy transcription to clipboard",
  "general.clipboard.desc": "Always copy the transcribed text to clipboard after dictation, in addition to inserting into the active field.",
  "general.clipboard.aria": "Enable copy transcription to clipboard",

  "recording.title": "Recording",
  "recording.desc": "Input behavior and MVP recording controls for Windows.",
  "recording.hotkey.label": "Global hotkey",
  "recording.hotkey.desc": "Activation key to start dictation anywhere in the system. The shortcut triggers the overlay in listening state.",
  "recording.hotkey.inputLabel": "Hotkey",
  "recording.hotkey.inputHint": "Examples: Ctrl+Shift+Space, Alt+Space",
  "recording.hotkey.badge.registered": "Registered",
  "recording.hotkey.badge.notRegistered": "Not registered",
  "recording.hotkey.apply": "Apply",
  "recording.hotkey.saving": "Saving...",
  "recording.hotkey.error.title": "Shortcut setup failed",
  "recording.hotkey.error.empty": "Shortcut cannot be empty.",
  "recording.hotkey.error.tooLong": "Shortcut is too long.",
  "recording.hotkey.error.registrationFailed": "Shortcut registration failed",
  "recording.hotkey.updateError": "Unable to update global shortcut.",
  "recording.hotkey.runtimeNotice": "Global shortcut works only inside the Tauri desktop runtime.",
  "recording.smartGain.label": "Smart input gain",
  "recording.smartGain.desc": "Smooth voice level for stable and clean speech capture.",
  "recording.smartGain.aria": "Enable smart input gain",
  "recording.noiseSuppression.label": "Noise suppression",
  "recording.noiseSuppression.desc": "Apply lightweight filtering before the transcription request.",
  "recording.noiseSuppression.aria": "Enable noise suppression",
  "recording.autoStop.label": "Auto-stop after silence",
  "recording.autoStop.desc": "Stop recording when voice activity stays low for a few seconds.",
  "recording.autoStop.aria": "Enable auto-stop",
  "recording.hotkey.capture.cancel": "Cancel recording",
  "recording.hotkey.capture.listening": "Listening for input...",
  "recording.hotkey.capture.pressHint": "Press your desired key combination...",

  "transcription.title": "Transcription",
  "transcription.desc": "Provider and model configuration used by the recording flow after stop.",
  "transcription.badge.configured": "API key configured",
  "transcription.badge.missing": "API key missing",
  "transcription.save": "Save Transcription Setup",
  "transcription.saved": "Transcription settings saved.",
  "transcription.savedNoKey": "Settings saved. Add an API key before transcription requests.",
  "transcription.provider.label": "Transcription provider",
  "transcription.provider.desc": "Select an OpenAI-compatible provider or enter a custom endpoint.",
  "transcription.provider.inputLabel": "Provider",
  "transcription.baseUrl.label": "Base URL",
  "transcription.baseUrl.desc": "API endpoint for the selected provider. Auto-filled for known providers.",
  "transcription.baseUrl.inputLabel": "Base URL",
  "transcription.apiKey.label": "API key",
  "transcription.apiKey.desc": "Authentication key for the selected provider API.",
  "transcription.apiKey.inputLabel": "API key",
  "transcription.apiKey.placeholder": "sk-...",
  "transcription.model.label": "Model",
  "transcription.model.desc": "Speech-to-text model that Dicta should call after recording.",
  "transcription.model.inputLabel": "Model",
  "transcription.models.load": "Load models",
  "transcription.models.loading": "Loading...",
  "transcription.models.needKey": "Enter an API key and base URL first.",
  "transcription.models.noStt": "No speech-to-text models found for this provider.",
  "transcription.models.loadError": "Could not load models from this provider.",
  "transcription.sttNotSupported.title": "STT not supported",
  "transcription.sttNotSupported.body": "This provider does not support speech-to-text. Use OpenAI or a custom provider for transcription.",
  "transcription.languageHint.label": "Language hint",
  "transcription.languageHint.desc": "Language sent to the transcription model. Set to match the language you speak for best accuracy.",
  "transcription.languageHint.inputLabel": "Language hint",
  "transcription.languageHint.placeholder": "Auto detect",
  "transcription.error.unsupportedProvider": "Unsupported transcription provider.",
  "transcription.error.unauthorized": "API request unauthorized. Check the API key.",
  "transcription.error.rateLimit": "Rate limit reached. Try again in a moment.",
  "transcription.error.server": "Server error. Please retry shortly.",
  "transcription.error.apiKeyEmpty": "API key is empty. Add it in Transcription settings.",
  "transcription.error.audioEmpty": "Recorded audio is empty. Please record again.",
  "transcription.error.cancelled": "Transcription request was cancelled.",
  "transcription.error.network": "Network error while contacting the transcription API.",
  "transcription.error.requestFailed": "Transcription request failed.",
  "transcription.error.emptyText": "API returned empty transcription text.",

  "transcription.customProviders.title": "Custom Providers",
  "transcription.customProviders.desc": "Add your own OpenAI-compatible providers. They will be available in both transcription and rewriter.",
  "transcription.customProviders.add": "Add Provider",
  "transcription.customProviders.empty": "No custom providers. Add your first one above.",
  "transcription.customProviders.namePlaceholder": "e.g. My Proxy",
  "transcription.customProviders.delete": "Delete",

  "history.title": "History",
  "history.desc": "Local list of successful transcriptions stored on this device.",
  "history.badge.items": "items",
  "history.clear": "Clear All",
  "history.empty.title": "History is empty",
  "history.empty.body": "No transcriptions yet. Start dictation from the Recording section. Every successful transcription is saved here even if insertion fails.",
  "history.action.copied": "Copied to clipboard.",
  "history.action.copyFailed": "Clipboard copy failed. Check clipboard permissions.",
  "history.action.deleted": "Transcription deleted.",
  "history.status.pending": "Pending",
  "history.status.inserted": "Inserted",
  "history.status.copied": "Copied",
  "history.status.failed": "Failed",
  "history.status.blocked": "Blocked",
  "history.units.chars": "chars",
  "history.units.words": "words",
  "history.copyAria": "Copy transcription",
  "history.deleteAria": "Delete transcription",

  "overlay.processing": "Transcribing",
  "overlay.actions.start": "Start recording",
  "overlay.actions.stop": "Stop recording",
  "overlay.actions.abort": "Abort dictation",
  "overlay.actions.dismiss": "Dismiss error",
  "overlay.actions.retry": "Retry",
  "overlay.error.defaultTitle": "Action needed",
  "overlay.error.defaultText": "Couldn't transcribe audio. Check the connection and retry.",
  "overlay.error.microphoneTitle": "Microphone error",
  "overlay.error.transcriptionFailedTitle": "Transcription failed",
  "overlay.error.insertionFailedTitle": "Insertion failed",
  "overlay.error.suspiciousBlockedTitle": "Suspicious transcription blocked",
  "overlay.success.inserted": "Inserted",
  "overlay.success.copied": "Copied",

  "quality.empty": "Transcription is empty.",
  "quality.assistantText": "Transcription looked like assistant-generated text instead of dictation.",
  "quality.durationMismatch": "Transcription was too long for the captured recording and was blocked.",
  "quality.repeatedContent": "Transcription contained repeated content and was blocked.",
  "quality.corrupted": "Transcription quality looked corrupted and was blocked.",

  "insertion.inserted": "Inserted into the active field.",
  "insertion.nativeFailed": "Automatic insertion failed with the native clipboard + paste strategy.",
  "insertion.nativeCommandFailed": "Native insertion command failed.",
  "insertion.clipboardUnavailable": "Unable to access clipboard fallback in this runtime.",
  "insertion.copiedFallback": "Auto-insert failed. Text was copied to the clipboard, press Ctrl+V manually.",
  "insertion.fallbackUnavailable": "Insertion failed and clipboard fallback was unavailable. Text is saved in History.",
  "insertion.emptyText": "Transcribed text is empty and cannot be inserted.",

  "nav.rewriter.label": "Rewriter",
  "nav.rewriter.desc": "AI text editing presets",

  "rewriter.title": "Text Rewriter",
  "rewriter.desc": "Select text anywhere, press the hotkey, and let AI rewrite it based on your custom presets.",
  "rewriter.save": "Save Changes",
  "rewriter.saved": "Rewriter settings saved.",
  "rewriter.reset": "Reset",
  "rewriter.reset.msg": "Rewriter settings reset to defaults.",
  "rewriter.hotkey.label": "Rewriter hotkey",
  "rewriter.hotkey.desc": "Global key to capture selected text and open the rewrite overlay.",
  "rewriter.hotkey.inputLabel": "Hotkey",
  "rewriter.hotkey.apply": "Apply",
  "rewriter.apiKey.label": "API key override",
  "rewriter.apiKey.desc": "Leave empty to use the transcription API key.",
  "rewriter.apiKey.inputLabel": "API key",
  "rewriter.apiKey.placeholder": "Use transcription key",
  "rewriter.provider.label": "Provider",
  "rewriter.provider.desc": "Select a provider for text rewriting. Custom providers from transcription settings are also available.",
  "rewriter.provider.inputLabel": "Provider",
  "rewriter.baseUrl.label": "Base URL override",
  "rewriter.baseUrl.desc": "Leave empty to use the transcription base URL.",
  "rewriter.baseUrl.inputLabel": "Base URL",
  "rewriter.baseUrl.placeholder": "Use transcription URL",
  "rewriter.model.label": "Model",
  "rewriter.model.desc": "Chat model to use for text rewriting.",
  "rewriter.model.inputLabel": "Model",
  "rewriter.models.load": "Load models",
  "rewriter.models.loading": "Loading...",
  "rewriter.models.needKey": "Enter an API key first.",
  "rewriter.models.noChat": "No chat models found for this provider.",
  "rewriter.models.loadError": "Could not load models.",
  "rewriter.presets.title": "Presets",
  "rewriter.presets.desc": "Custom rewrite instructions. Add your own presets that appear in the overlay.",
  "rewriter.presets.add": "Add Preset",
  "rewriter.presets.empty": "No presets yet. Add your first one above.",
  "rewriter.presets.name": "Name",
  "rewriter.presets.icon": "Icon",
  "rewriter.presets.prompt": "Prompt",
  "rewriter.presets.promptPlaceholder": "e.g. Translate this text to English",
  "rewriter.presets.delete": "Delete",
  "rewriter.presets.namePlaceholder": "e.g. Translate EN",
  "rewriter.presets.untitled": "Untitled preset",
  "rewriter.presets.promptEditor.title": "Edit instruction",
  "rewriter.presets.promptEditor.hint": "Ctrl+Enter to save · Escape to cancel",

  "rewriter.overlay.placeholder": "Describe what to do with the text...",
  "rewriter.overlay.send": "Send",
  "rewriter.overlay.insert": "Insert",
  "rewriter.overlay.copy": "Copy",
  "rewriter.overlay.rewrite": "Rewrite",
  "rewriter.overlay.cancel": "Cancel",
  "rewriter.overlay.processing": "Rewriting...",
  "rewriter.overlay.noText": "No text selected",
};

export type TranslationKey = keyof typeof en;
type TranslationDictionary = Record<TranslationKey, string>;

const ru: TranslationDictionary = {
  "vo.title": "Dicta",
  "vo.subtitle": "Диктовка для Windows",
  "common.logoAlt": "Логотип Dicta",
  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.language.en": "Английский",
  "common.language.ru": "Русский",

  "nav.general.label": "Основные",
  "nav.general.desc": "Поведение приложения",
  "nav.recording.label": "Запись",
  "nav.recording.desc": "Микрофон и хоткеи",
  "nav.transcription.label": "Транскрибация",
  "nav.transcription.desc": "Модель и форматирование",
  "nav.history.label": "История",
  "nav.history.desc": "Недавние записи",
  "nav.about.label": "О программе",
  "nav.about.desc": "Информация о продукте",

  "shell.title": "Оболочка",

  "about.title": "О Dicta",
  "about.desc": "Глобальная голосовая диктовка для Windows с удобным оверлеем.",
  "about.version": "Версия 0.1.0-beta",
  "about.badge": "Бета-версия",
  "about.dev.label": "Разработчик",
  "about.dev.name": "Ботанутый Костя",
  "about.telegram": "Telegram",
  "about.blurb": "Dicta — это чистый, минималистичный оверлей диктовки, созданный специально для Windows. Нажмите глобальный хоткей в любом месте, скажите текст, и он будет вставлен прямо в активное приложение.",

  "general.title": "Основные",
  "general.desc": "Основные настройки поведения и оболочки.",
  "general.reset": "Сбросить",
  "general.save": "Сохранить",
  "general.profile.label": "Имя профиля",
  "general.profile.desc": "Имя для этого компьютера и будущей синхронизации.",
  "general.profile.inputLabel": "Профиль",
  "general.autostart.label": "Запускать вместе с Windows",
  "general.autostart.desc": "Автоматически запускать Dicta при входе в систему.",
  "general.autostart.aria": "Включить запуск вместе с Windows",
  "general.tray.label": "Сворачивать в трей",
  "general.tray.desc": "Оставлять приложение работать в фоне при закрытии.",
  "general.tray.aria": "Включить сворачивание в трей",
  "general.notifications.label": "Уведомления на рабочем столе",
  "general.notifications.desc": "Показывать компактные уведомления о событиях диктовки.",
  "general.notifications.aria": "Включить уведомления на рабочем столе",
  "general.language.label": "Язык интерфейса",
  "general.language.desc": "Язык отображения интерфейса приложения.",
  "general.language.selectAria": "Выбрать язык интерфейса",
  "general.saved": "Общие настройки сохранены.",
  "general.reset.msg": "Общие настройки сброшены по умолчанию.",
  "general.clipboard.label": "Копировать транскрипцию в буфер",
  "general.clipboard.desc": "Всегда копировать транскрибированный текст в буфер обмена после диктовки, помимо вставки в активное поле.",
  "general.clipboard.aria": "Включить копирование транскрипции в буфер",

  "recording.title": "Запись",
  "recording.desc": "Поведение ввода и базовые настройки записи для Windows.",
  "recording.hotkey.label": "Глобальный хоткей",
  "recording.hotkey.desc": "Клавиша активации для запуска диктовки в любом месте системы. Хоткей переводит оверлей в режим прослушивания.",
  "recording.hotkey.inputLabel": "Хоткей",
  "recording.hotkey.inputHint": "Примеры: Ctrl+Shift+Space, Alt+Space",
  "recording.hotkey.badge.registered": "Зарегистрирован",
  "recording.hotkey.badge.notRegistered": "Не зарегистрирован",
  "recording.hotkey.apply": "Применить",
  "recording.hotkey.saving": "Сохранение...",
  "recording.hotkey.error.title": "Не удалось настроить хоткей",
  "recording.hotkey.error.empty": "Хоткей не может быть пустым.",
  "recording.hotkey.error.tooLong": "Хоткей слишком длинный.",
  "recording.hotkey.error.registrationFailed": "Не удалось зарегистрировать хоткей",
  "recording.hotkey.updateError": "Не удалось обновить глобальный хоткей.",
  "recording.hotkey.runtimeNotice": "Глобальный хоткей работает только в десктопном приложении Tauri.",
  "recording.smartGain.label": "Умное усиление входа",
  "recording.smartGain.desc": "Выравнивает уровень голоса для стабильного и чистого захвата речи.",
  "recording.smartGain.aria": "Включить умное усиление входа",
  "recording.noiseSuppression.label": "Подавление шума",
  "recording.noiseSuppression.desc": "Применять лёгкую фильтрацию перед запросом на транскрибацию.",
  "recording.noiseSuppression.aria": "Включить подавление шума",
  "recording.autoStop.label": "Автостоп после тишины",
  "recording.autoStop.desc": "Останавливать запись, когда голосовая активность несколько секунд остаётся низкой.",
  "recording.autoStop.aria": "Включить автостоп",
  "recording.hotkey.capture.cancel": "Отменить запись хоткея",
  "recording.hotkey.capture.listening": "Ожидание ввода...",
  "recording.hotkey.capture.pressHint": "Нажмите нужную комбинацию клавиш...",

  "transcription.title": "Транскрибация",
  "transcription.desc": "Настройка провайдера и модели, которые используются после остановки записи.",
  "transcription.badge.configured": "API-ключ настроен",
  "transcription.badge.missing": "API-ключ отсутствует",
  "transcription.save": "Сохранить настройки транскрибации",
  "transcription.saved": "Настройки транскрибации сохранены.",
  "transcription.savedNoKey": "Настройки сохранены. Добавьте API-ключ перед отправкой запросов на транскрибацию.",
  "transcription.provider.label": "Провайдер транскрибации",
  "transcription.provider.desc": "Выберите OpenAI-совместимый провайдер или укажите свой эндпоинт.",
  "transcription.provider.inputLabel": "Провайдер",
  "transcription.baseUrl.label": "Base URL",
  "transcription.baseUrl.desc": "Эндпоинт API выбранного провайдера. Заполняется автоматически для известных провайдеров.",
  "transcription.baseUrl.inputLabel": "Base URL",
  "transcription.apiKey.label": "API-ключ",
  "transcription.apiKey.desc": "Ключ аутентификации для API выбранного провайдера.",
  "transcription.apiKey.inputLabel": "API-ключ",
  "transcription.apiKey.placeholder": "sk-...",
  "transcription.model.label": "Модель",
  "transcription.model.desc": "Модель распознавания речи, которую Dicta вызывает после записи.",
  "transcription.model.inputLabel": "Модель",
  "transcription.models.load": "Загрузить модели",
  "transcription.models.loading": "Загрузка...",
  "transcription.models.needKey": "Сначала введите API-ключ и Base URL.",
  "transcription.models.noStt": "Модели распознавания речи не найдены у этого провайдера.",
  "transcription.models.loadError": "Не удалось загрузить модели.",
  "transcription.sttNotSupported.title": "STT не поддерживается",
  "transcription.sttNotSupported.body": "Этот провайдер не поддерживает распознавание речи. Используйте OpenAI или кастомный провайдер для транскрибации.",
  "transcription.languageHint.label": "Язык транскрибации",
  "transcription.languageHint.desc": "Язык, отправляемый модели транскрибации. Установите язык, на котором вы говорите, для лучшей точности.",
  "transcription.languageHint.inputLabel": "Подсказка языка",
  "transcription.languageHint.placeholder": "Автоопределение",
  "transcription.error.unsupportedProvider": "Неподдерживаемый провайдер транскрибации.",
  "transcription.error.unauthorized": "Запрос к API отклонён. Проверьте API-ключ.",
  "transcription.error.rateLimit": "Достигнут лимит запросов. Попробуйте ещё раз чуть позже.",
  "transcription.error.server": "Ошибка сервера. Повторите попытку чуть позже.",
  "transcription.error.apiKeyEmpty": "API-ключ пуст. Добавьте его в настройках транскрибации.",
  "transcription.error.audioEmpty": "Записанное аудио пустое. Пожалуйста, запишите ещё раз.",
  "transcription.error.cancelled": "Запрос на транскрибацию был отменён.",
  "transcription.error.network": "Сетевая ошибка при обращении к API транскрибации.",
  "transcription.error.requestFailed": "Запрос на транскрибацию завершился ошибкой.",
  "transcription.error.emptyText": "API вернул пустой текст транскрипции.",

  "transcription.customProviders.title": "Кастомные провайдеры",
  "transcription.customProviders.desc": "Добавьте свои OpenAI-совместимые провайдеры. Они будут доступны и в транскрибации, и в рерайтере.",
  "transcription.customProviders.add": "Добавить",
  "transcription.customProviders.empty": "Кастомных провайдеров пока нет. Добавьте первый.",
  "transcription.customProviders.namePlaceholder": "напр. Мой прокси",
  "transcription.customProviders.delete": "Удалить",

  "history.title": "История",
  "history.desc": "Локальный список успешных транскрипций, сохранённых на этом устройстве.",
  "history.badge.items": "элементов",
  "history.clear": "Очистить всё",
  "history.empty.title": "История пуста",
  "history.empty.body": "Транскрипций пока нет. Запустите диктовку из раздела «Запись». Каждая успешная транскрипция сохраняется здесь, даже если вставка не удалась.",
  "history.action.copied": "Скопировано в буфер обмена.",
  "history.action.copyFailed": "Не удалось скопировать в буфер обмена. Проверьте разрешения буфера.",
  "history.action.deleted": "Транскрипция удалена.",
  "history.status.pending": "В ожидании",
  "history.status.inserted": "Вставлено",
  "history.status.copied": "Скопировано",
  "history.status.failed": "Ошибка",
  "history.status.blocked": "Заблокировано",
  "history.units.chars": "симв.",
  "history.units.words": "слов",
  "history.copyAria": "Скопировать транскрипцию",
  "history.deleteAria": "Удалить транскрипцию",

  "overlay.processing": "Транскрибация",
  "overlay.actions.start": "Начать запись",
  "overlay.actions.stop": "Остановить запись",
  "overlay.actions.abort": "Прервать диктовку",
  "overlay.actions.dismiss": "Закрыть ошибку",
  "overlay.actions.retry": "Повторить",
  "overlay.error.defaultTitle": "Требуется действие",
  "overlay.error.defaultText": "Не удалось транскрибировать аудио. Проверьте подключение и попробуйте снова.",
  "overlay.error.microphoneTitle": "Ошибка микрофона",
  "overlay.error.transcriptionFailedTitle": "Ошибка транскрибации",
  "overlay.error.insertionFailedTitle": "Ошибка вставки",
  "overlay.error.suspiciousBlockedTitle": "Подозрительная транскрипция заблокирована",
  "overlay.success.inserted": "Вставлено",
  "overlay.success.copied": "Скопировано",

  "quality.empty": "Транскрипция пуста.",
  "quality.assistantText": "Транскрипция похожа на сгенерированный ответ ассистента, а не на диктовку.",
  "quality.durationMismatch": "Транскрипция оказалась слишком длинной для записанного аудио и была заблокирована.",
  "quality.repeatedContent": "В транскрипции обнаружен повторяющийся контент, поэтому она была заблокирована.",
  "quality.corrupted": "Качество транскрипции выглядит повреждённым, поэтому она была заблокирована.",

  "insertion.inserted": "Текст вставлен в активное поле.",
  "insertion.nativeFailed": "Автоматическая вставка не удалась при использовании нативной стратегии буфера обмена и вставки.",
  "insertion.nativeCommandFailed": "Не удалось выполнить нативную команду вставки.",
  "insertion.clipboardUnavailable": "В этом runtime недоступен резервный вариант через буфер обмена.",
  "insertion.copiedFallback": "Автовставка не удалась. Текст скопирован в буфер обмена, нажмите Ctrl+V вручную.",
  "insertion.fallbackUnavailable": "Вставка не удалась, и резервный вариант через буфер обмена тоже недоступен. Текст сохранён в истории.",
  "insertion.emptyText": "Распознанный текст пуст и не может быть вставлен.",

  "nav.rewriter.label": "Рерайтер",
  "nav.rewriter.desc": "AI-редактирование текста",

  "rewriter.title": "Рерайтер текста",
  "rewriter.desc": "Выделите текст где угодно, нажмите хоткей, и AI перепишет его по вашим пресетам.",
  "rewriter.save": "Сохранить",
  "rewriter.saved": "Настройки рерайтера сохранены.",
  "rewriter.reset": "Сбросить",
  "rewriter.reset.msg": "Настройки рерайтера сброшены.",
  "rewriter.hotkey.label": "Горячая клавиша",
  "rewriter.hotkey.desc": "Глобальная клавиша для захвата текста и открытия оверлея.",
  "rewriter.hotkey.inputLabel": "Горячая клавиша",
  "rewriter.hotkey.apply": "Применить",
  "rewriter.apiKey.label": "Свой API-ключ",
  "rewriter.apiKey.desc": "Оставьте пустым, чтобы использовать ключ транскрибации.",
  "rewriter.apiKey.inputLabel": "API-ключ",
  "rewriter.apiKey.placeholder": "Ключ транскрибации",
  "rewriter.provider.label": "Провайдер",
  "rewriter.provider.desc": "Выберите провайдер для рерайта. Кастомные провайдеры из настроек транскрибации тоже доступны.",
  "rewriter.provider.inputLabel": "Провайдер",
  "rewriter.baseUrl.label": "Свой Base URL",
  "rewriter.baseUrl.desc": "Оставьте пустым, чтобы использовать URL транскрибации.",
  "rewriter.baseUrl.inputLabel": "Base URL",
  "rewriter.baseUrl.placeholder": "URL транскрибации",
  "rewriter.model.label": "Модель",
  "rewriter.model.desc": "Chat-модель для перезаписи текста.",
  "rewriter.model.inputLabel": "Модель",
  "rewriter.models.load": "Загрузить модели",
  "rewriter.models.loading": "Загрузка...",
  "rewriter.models.needKey": "Сначала введите API-ключ.",
  "rewriter.models.noChat": "Chat-модели не найдены у этого провайдера.",
  "rewriter.models.loadError": "Не удалось загрузить модели.",
  "rewriter.presets.title": "Пресеты",
  "rewriter.presets.desc": "Пользовательские инструкции. Добавьте свои пресеты, которые будут отображаться в оверлее.",
  "rewriter.presets.add": "Добавить",
  "rewriter.presets.empty": "Пресетов пока нет. Добавьте первый.",
  "rewriter.presets.name": "Имя",
  "rewriter.presets.icon": "Иконка",
  "rewriter.presets.prompt": "Промпт",
  "rewriter.presets.promptPlaceholder": "напр. Переведи этот текст на английский",
  "rewriter.presets.delete": "Удалить",
  "rewriter.presets.namePlaceholder": "напр. Перевод EN",
  "rewriter.presets.untitled": "Без названия",
  "rewriter.presets.promptEditor.title": "Редактирование инструкции",
  "rewriter.presets.promptEditor.hint": "Ctrl+Enter чтобы сохранить · Escape чтобы отменить",

  "rewriter.overlay.placeholder": "Опишите, что сделать с текстом...",
  "rewriter.overlay.send": "Отправить",
  "rewriter.overlay.insert": "Вставить",
  "rewriter.overlay.copy": "Копировать",
  "rewriter.overlay.rewrite": "Переписать",
  "rewriter.overlay.cancel": "Отмена",
  "rewriter.overlay.processing": "Переписываю...",
  "rewriter.overlay.noText": "Текст не выделен",
};

const dictionaries: Record<AppLanguage, TranslationDictionary> = { en, ru };
const localeMap: Record<AppLanguage, string> = {
  en: "en-US",
  ru: "ru-RU",
};

const languageListeners = new Set<() => void>();
let currentLanguage: AppLanguage = "ru";
let bootstrapPromise: Promise<void> | null = null;

function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" ? "en" : "ru";
}

function notifyLanguageListeners() {
  if (typeof document !== "undefined") {
    document.documentElement.lang = currentLanguage;
  }
  languageListeners.forEach((listener) => listener());
}

export function getAppLanguage(): AppLanguage {
  return currentLanguage;
}

export function getAppLocale(): string {
  return localeMap[currentLanguage];
}

export function setAppLanguage(language: AppLanguage): void {
  const nextLanguage = normalizeLanguage(language);
  if (nextLanguage === currentLanguage) {
    if (typeof document !== "undefined") {
      document.documentElement.lang = currentLanguage;
    }
    return;
  }

  currentLanguage = nextLanguage;
  notifyLanguageListeners();
}

export function translate(key: TranslationKey): string {
  return dictionaries[currentLanguage][key] ?? key;
}

function subscribeToLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  return () => {
    languageListeners.delete(listener);
  };
}

export async function bootstrapI18n(): Promise<void> {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    try {
      const settings = await loadSharedGeneralSettings();
      setAppLanguage(normalizeLanguage(settings.language));
    } catch {
      notifyLanguageListeners();
    }

    try {
      await listenForSharedGeneralSettingsSync(async () => {
        const settings = await loadSharedGeneralSettings();
        setAppLanguage(normalizeLanguage(settings.language));
      });
    } catch {
      // Ignore runtime sync registration failures and keep local language state working.
    }
  })();

  return bootstrapPromise;
}

if (typeof document !== "undefined") {
  document.documentElement.lang = currentLanguage;
}

export function useTranslation() {
  void bootstrapI18n();

  const language = useSyncExternalStore(
    subscribeToLanguage,
    getAppLanguage,
    getAppLanguage,
  );

  const t = useCallback((key: TranslationKey): string => {
    return dictionaries[language][key] ?? key;
  }, [language]);

  return { t, language };
}
