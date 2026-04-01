import { SectionCard } from "../../components/SectionCard";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PillBadge } from "../../components/ui/PillBadge";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../lib/i18n";

export function AboutSection() {
  const { t } = useTranslation();

  function handleWebsiteClick() {
    void openUrl("https://t.me/kostik_neuro");
  }

  return (
    <div className="grid gap-5">
      <SectionCard
        title={t("about.title")}
        description={t("about.desc")}
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-2xl bg-black shadow-[0_0_30px_rgba(98,220,192,0.15)] ring-1 ring-white/10">
            <img src="/logo.png" alt={t("common.logoAlt")} className="h-full w-full object-cover" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              {t("vo.title")}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-subtle)]">
              {t("about.version")}
            </p>
          </div>
          <PillBadge tone="success">{t("about.badge")}</PillBadge>
        </div>

        <div className="mt-2 grid gap-4">
          <Card tone="soft" className="flex items-center justify-between rounded-[var(--radius-md)] p-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("about.dev.label")}</p>
              <p className="text-sm text-[var(--color-text-subtle)]">{t("about.dev.name")}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleWebsiteClick}>
              {t("about.telegram")}
            </Button>
          </Card>

          <Card tone="soft" className="rounded-[var(--radius-md)] p-4">
            <p className="text-sm leading-6 text-[var(--color-text-subtle)]">
              {t("about.blurb")}
            </p>
          </Card>
        </div>
      </SectionCard>
    </div>
  );
}