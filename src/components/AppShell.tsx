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
      <div className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-emerald-300/20 blur-[var(--blur-lg)]" />
      <div className="pointer-events-none absolute -right-20 top-14 h-72 w-72 rounded-full bg-cyan-400/15 blur-[var(--blur-lg)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] gap-6 p-5 lg:p-7">
        <aside className="w-[300px] shrink-0">{sidebar}</aside>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)]">
          <header className="flex items-end justify-between gap-5 px-7 pb-5 pt-7">
            <div>
              <p className="ui-subtle text-xs uppercase tracking-[0.16em]">
                {t("shell.title")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
                {description}
              </p>
            </div>

            <div className="flex items-center gap-2">
            </div>
          </header>

          <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />

          <section className="flex-1 overflow-y-auto px-7 py-6">{children}</section>
        </Card>
      </div>
    </div>
  );
}
