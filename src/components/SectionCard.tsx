import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Card } from "./ui/Card";
import { SectionHeader } from "./ui/SectionHeader";

interface SectionCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card className={cn("rounded-[var(--radius-xl)] p-6", className)} tone="soft">
      <SectionHeader title={title} description={description} actions={actions} />
      {children}
    </Card>
  );
}
