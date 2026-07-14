import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ToastProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: ToastTone;
};

const toneClasses: Record<ToastTone, string> = {
  neutral: "border-[var(--line-strong)] text-[var(--ink)]",
  info: "border-[var(--info)] text-[var(--info)]",
  success: "border-[var(--success-line)] text-[var(--success)]",
  warning: "border-[var(--warning-line)] text-[var(--warning)]",
  danger: "border-[var(--danger-line)] text-[var(--danger)]",
};

export function Toast({ action, children, className, tone = "neutral" }: ToastProps) {
  return (
    <div
      aria-atomic="true"
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full items-start justify-between gap-4 border bg-[var(--paper-raised)] p-4 text-sm shadow-[var(--shadow-raised)]",
        toneClasses[tone],
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-[var(--ink)]">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
