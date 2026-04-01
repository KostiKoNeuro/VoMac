import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { Sidebar } from "./components/Sidebar";
import { HistorySection } from "./features/history/HistorySection";
import { RecordingSection } from "./features/recording/RecordingSection";
import { DictationOverlayWindow } from "./features/recording/overlay/DictationOverlayWindow";
import { RewriterOverlayWindow } from "./features/rewriter/overlay/RewriterOverlayWindow";
import { RewriterSection } from "./features/rewriter/RewriterSection";
import { AboutSection } from "./features/settings/AboutSection";
import { GeneralSection } from "./features/settings/GeneralSection";
import { TranscriptionSection } from "./features/transcription/TranscriptionSection";
import { appSections } from "./lib/sections";
import { registerTrayEventHandlers } from "./lib/tauri/trayEvents";
import { getCurrentAppWindowLabel, markWindowReady } from "./lib/tauri/window";
import type { AppSectionId } from "./types/navigation";
import { useTranslation } from "./lib/i18n";
import "./features/rewriter/overlay/RewriterOverlay.css";

function MainAppWindow() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<AppSectionId>("general");

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | null = null;

    void registerTrayEventHandlers({
      onShowHistory: () => {
        setActiveSection("history");
      },
    }).then((cleanup) => {
      if (!mounted) {
        cleanup();
        return;
      }

      unlisten = cleanup;
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  const sectionContent = useMemo(() => {
    switch (activeSection) {
      case "general":
        return <GeneralSection />;
      case "recording":
        return <RecordingSection />;
      case "transcription":
        return <TranscriptionSection />;
      case "rewriter":
        return <RewriterSection />;
      case "history":
        return <HistorySection />;
      case "about":
        return <AboutSection />;
      default:
        return <GeneralSection />;
    }
  }, [activeSection]);

  return (
    <AppShell
      title={t("vo.title" as any)}
      description={t("about.desc")}
      sidebar={
        <Sidebar
          items={appSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {sectionContent}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

function App() {
  const currentWindowLabel = getCurrentAppWindowLabel();

  useEffect(() => {
    document.body.dataset.window = currentWindowLabel;
    if (currentWindowLabel === "main") {
      void markWindowReady("main");
    }

    return () => {
      delete document.body.dataset.window;
    };
  }, [currentWindowLabel]);

  if (currentWindowLabel === "overlay") {
    return <DictationOverlayWindow />;
  }

  if (currentWindowLabel === "rewriter") {
    return <RewriterOverlayWindow />;
  }

  return <MainAppWindow />;
}

export default App;
