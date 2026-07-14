import { CheckIcon, CircleIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentTimelineStep = {
  detail?: string;
  id: string;
  label: string;
  status: "complete" | "active" | "pending" | "error";
};

export function AgentTimeline({ label = "Agent progress", steps }: { label?: string; steps: readonly AgentTimelineStep[] }) {
  return (
    <ol aria-label={label} className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {steps.map((step) => {
        const statusLabel = getStatusLabel(step.status);
        return (
          <li
            aria-current={step.status === "active" ? "step" : undefined}
            key={step.id}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 py-3"
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-7 items-center justify-center rounded-full border [&_svg]:size-3.5",
                step.status === "complete" && "border-[var(--success-line)] bg-[var(--success-soft)] text-[var(--success)]",
                step.status === "active" && "border-[var(--clay)] bg-[var(--clay-soft)] text-[var(--clay-strong)]",
                step.status === "pending" && "border-[var(--line)] bg-[var(--paper-soft)] text-[var(--ink-faint)]",
                step.status === "error" && "border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger)]",
              )}
            >
              {step.status === "complete" ? <CheckIcon /> : step.status === "active" ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : <CircleIcon />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--ink-strong)]">{step.label}</span>
              {step.detail ? <span className="mt-0.5 block text-xs leading-5 text-[var(--ink-muted)]">{step.detail}</span> : null}
            </span>
            <span className="pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
              {statusLabel}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function getStatusLabel(status: AgentTimelineStep["status"]): string {
  if (status === "complete") return "Complete";
  if (status === "active") return "In progress";
  if (status === "error") return "Needs attention";
  return "Pending";
}
