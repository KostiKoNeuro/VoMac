import ReactDOM from "react-dom/client";
import App from "./App";
import { TranscriptionHistoryProvider } from "./features/history/context/TranscriptionHistoryContext";
import { TranscriptionSettingsProvider } from "./features/transcription/context/TranscriptionSettingsContext";
import { bootstrapI18n } from "./lib/i18n";
import "./styles/globals.css";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

void bootstrapI18n().finally(() => {
  root.render(
    <TranscriptionSettingsProvider>
      <TranscriptionHistoryProvider>
        <App />
      </TranscriptionHistoryProvider>
    </TranscriptionSettingsProvider>,
  );
});