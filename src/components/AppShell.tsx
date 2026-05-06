import type { ReactNode } from "react";
import { Card } from "./ui/Card";
import { useTranslation } from "../lib/i18n";

interface AppShellProps {
  title: string;
  description: string;
  sidebar: ReactNode;
  children: ReactNode;
}

export function AppShell({ title, description, sidebar, children }: AppShellProps) {
  const { t } = useTranslation();

  return (
    <div className="relative min-h-screen overflow-hidden antialiased">
      {/* Subtle ambient glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-[var(--color-accent)]/[0.04] blur-[48px]" />
      <div className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full bg-[var(--color-accent)]/[0.03] blur-[48px]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1340px] gap-5 p-5 lg:p-6">
        <aside className="w-[240px] shrink-0">{sidebar}</aside>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)]">
          <header className="flex items-end justify-between gap-5 px-6 pb-5 pt-6">
            <div>
              <p className="ui-subtle text-[11px] uppercase tracking-[0.16em]">
                {t("shell.title")}
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-text-muted)]">
                {description}
              </p>
            </div>
          </header>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />

          <section className="flex-1 overflow-y-auto px-6 py-5">{children}</section>
        </Card>
      </div>
    </div>
  );
}
