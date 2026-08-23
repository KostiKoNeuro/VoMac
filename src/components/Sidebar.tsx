import { motion } from "motion/react";
import { cn } from "../lib/cn";
import type { AppSection, AppSectionId } from "../types/navigation";
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
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2.5 px-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_0_18px_-4px_rgba(129,140,248,0.65)]">
          <img src="/logo.png" alt={t("common.logoAlt")} className="h-8 w-8 object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("vo.title")}
          </p>
          <p className="text-[11px] text-[var(--color-text-subtle)]">{t("vo.subtitle")}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="grid gap-1">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "ui-interactive ui-focus group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-left",
                isActive
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-[var(--color-text-primary)]",
              )}
            >
              {/* Sliding active pill */}
              {isActive && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl border border-[var(--color-accent)]/25 bg-gradient-to-r from-[var(--color-accent)]/[0.16] via-[var(--color-accent)]/[0.06] to-transparent shadow-[0_0_20px_-8px_rgba(129,140,248,0.55)]"
                />
              )}

              <Icon
                className={cn(
                  "relative z-10 h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-[var(--color-accent-strong)]"
                    : "opacity-80 group-hover:opacity-100",
                )}
              />
              <div className="relative z-10 min-w-0">
                <p className="text-sm font-medium">{t(item.label as any)}</p>
                <p className="text-[11px] text-[var(--color-text-subtle)]">{t(item.description as any)}</p>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
