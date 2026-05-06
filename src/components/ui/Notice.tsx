import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn";

type NoticeTone = "info" | "success" | "warning" | "error";

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const toneClassMap: Record<NoticeTone, string> = {
  info: "border-violet-200/20 bg-violet-200/10 text-violet-100/85",
  success: "border-indigo-200/25 bg-indigo-200/10 text-indigo-100/85",
  warning: "border-amber-200/25 bg-amber-200/10 text-amber-100/85",
  error: "border-rose-200/30 bg-rose-200/10 text-rose-100/88",
};

const toneIconMap: Record<NoticeTone, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
};

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: NoticeProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border px-3 py-2",
        toneClassMap[tone],
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 opacity-85">{toneIconMap[tone]}</div>
        <div className="min-w-0">
          {title ? <p className="text-xs font-semibold tracking-[0.01em]">{title}</p> : null}
          <p className={cn("text-xs leading-5", title && "mt-0.5")}>{children}</p>
        </div>
      </div>
    </div>
  );
}
