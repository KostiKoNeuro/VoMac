import { AnimatePresence, motion } from "motion/react";
import { Copy, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionCard } from "../../components/SectionCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { IconButton } from "../../components/ui/IconButton";
import { Notice } from "../../components/ui/Notice";
import { PillBadge } from "../../components/ui/PillBadge";
import { getAppLocale, translate, useTranslation } from "../../lib/i18n";
import { useTranscriptionHistory } from "./context/TranscriptionHistoryContext";
import type { HistoryItemStatus } from "./types";

const statusTone: Record<HistoryItemStatus, "neutral" | "accent" | "success" | "error"> = {
  pending: "neutral",
  inserted: "success",
  copied: "accent",
  failed: "error",
  blocked: "error",
};

function getStatusLabel(status: HistoryItemStatus): string {
  switch (status) {
    case "pending":
      return translate("history.status.pending");
    case "inserted":
      return translate("history.status.inserted");
    case "copied":
      return translate("history.status.copied");
    case "failed":
      return translate("history.status.failed");
    case "blocked":
      return translate("history.status.blocked");
    default:
      return status;
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);

  return new Intl.DateTimeFormat(getAppLocale(), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function HistorySection() {
  useTranslation();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const { items, markCopied, deleteHistoryItem, clearHistory } = useTranscriptionHistory();

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage(null);
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionMessage]);

  async function handleCopy(itemId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(itemId);
      setActionMessage(translate("history.action.copied"));
    } catch {
      setActionMessage(translate("history.action.copyFailed"));
    }
  }

  return (
    <div className="grid gap-5">
      <SectionCard
        title={translate("history.title")}
        description={translate("history.desc")}
        actions={
          <div className="flex items-center gap-2">
            <PillBadge tone="neutral">{items.length} {translate("history.badge.items")}</PillBadge>
            <Button variant="ghost" onClick={clearHistory} disabled={items.length === 0}>
              {translate("history.clear")}
            </Button>
          </div>
        }
      >
        <AnimatePresence>
          {actionMessage ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mb-4"
            >
              <Notice tone="info">{actionMessage}</Notice>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {items.length === 0 ? (
          <Card tone="soft" className="ui-empty-state rounded-[var(--radius-md)] p-5">
            <Notice tone="info" title={translate("history.empty.title")}>
              {translate("history.empty.body")}
            </Notice>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <Card tone="soft" className="rounded-[var(--radius-md)] p-4" hoverable>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PillBadge tone={statusTone[item.status]}>
                        {getStatusLabel(item.status)}
                      </PillBadge>
                      {item.kind === "rewrite" ? (
                        <PillBadge tone="accent">{translate("history.kind.rewrite")}</PillBadge>
                      ) : null}
                      <PillBadge tone="neutral">{formatTimestamp(item.createdAt)}</PillBadge>
                      <PillBadge tone="neutral">{item.charLength} {translate("history.units.chars")}</PillBadge>
                      <PillBadge tone="neutral">{item.wordCount} {translate("history.units.words")}</PillBadge>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconButton
                        icon={<Copy className="h-4 w-4" />}
                        label={translate("history.copyAria")}
                        onClick={() => void handleCopy(item.id, item.text)}
                      />
                      <IconButton
                        icon={<Trash2 className="h-4 w-4" />}
                        label={translate("history.deleteAria")}
                        onClick={() => {
                          deleteHistoryItem(item.id);
                          setActionMessage(translate("history.action.deleted"));
                        }}
                      />
                    </div>
                  </div>

                  {item.kind === "rewrite" && item.sourceText ? (
                    <p className="mt-3 border-l-2 border-[var(--color-border)] pl-3 text-xs leading-5 text-[var(--color-text-subtle)]">
                      {translate("history.rewrite.sourceLabel")}: {item.sourceText}
                    </p>
                  ) : null}

                  <p className="mt-3 text-sm leading-6 text-[var(--color-text-primary)]">
                    {item.text}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <PillBadge tone="neutral">{item.provider}</PillBadge>
                    <PillBadge tone="neutral">{item.model}</PillBadge>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}