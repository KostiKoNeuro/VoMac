import { motion } from "motion/react";
import { cn } from "../lib/cn";
import type { AppSection, AppSectionId } from "../types/navigation";
import { Card } from "./ui/Card";
import { useTranslation } from "../lib/i18n";

interface SidebarProps {
  items: AppSection[];
  activeSection: AppSectionId;
  onSectionChange: (sectionId: AppSectionId) => void;
}

export function Sidebar({
  items,
  activeSection,
  onSectionChange,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex h-full flex-col rounded-[var(--radius-xl)] p-4" tone="soft">
      <Card className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3" tone="soft">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-black">
          <img src="/logo.png" alt={t("common.logoAlt")} className="h-10 w-10 object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">
            {t("vo.title")}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">{t("vo.subtitle")}</p>
        </div>
      </Card>

      <nav className="mt-5 grid gap-2">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "ui-interactive ui-focus group relative overflow-hidden rounded-[var(--radius-md)] px-3 py-3 text-left",
                isActive
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:text-[var(--color-text-primary)]",
              )}
            >
              {isActive ? (
                <motion.div
                  layoutId="active-section"
                  className="absolute inset-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/[0.08]"
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    mass: 0.2,
                  }}
                />
              ) : null}
              <div className="relative flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <div>
                  <p className="text-sm font-medium">{t(item.label as any)}</p>
                  <p className="text-xs text-[var(--color-text-subtle)] group-hover:text-[var(--color-text-muted)]">
                    {t(item.description as any)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </Card>
  );
}