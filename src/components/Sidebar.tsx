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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
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
      <nav className="grid gap-0.5">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "ui-interactive ui-focus group flex items-center gap-2.5 rounded-lg px-3 py-2 text-left",
                isActive
                  ? "bg-white/[0.06] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-white/[0.03] hover:text-[var(--color-text-primary)]",
              )}
            >
              {/* Active indicator */}
              <span
                className={cn(
                  "h-4 w-0.5 shrink-0 rounded-full transition-all",
                  isActive
                    ? "bg-[var(--color-accent)]"
                    : "bg-transparent group-hover:bg-white/[0.08]",
                )}
              />

              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              <div className="min-w-0">
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
