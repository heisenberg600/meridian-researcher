import { CheckCircle2Icon, MessageSquareWarningIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "./Button";

export type ApprovalStatus = "pending" | "approved" | "changes_requested";

export type ApprovalCardProps = {
  description: string;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  resolvedBy?: string;
  status: ApprovalStatus;
  title: string;
};

export function ApprovalCard({
  description,
  onApprove,
  onRequestChanges,
  resolvedBy,
  status,
  title,
}: ApprovalCardProps) {
  const headingId = `approval-${useId().replaceAll(":", "")}`;
  const resolved = status !== "pending";

  return (
    <section
      aria-labelledby={headingId}
      className="border border-[var(--line)] bg-[var(--paper-raised)] p-5 shadow-[var(--shadow-paper)] sm:p-6"
      role={resolved ? "status" : undefined}
    >
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--clay-soft)] text-[var(--clay-strong)] [&_svg]:size-4">
          {status === "approved" ? <CheckCircle2Icon /> : <MessageSquareWarningIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--clay-strong)]">
            {status === "pending" ? "Human review" : status === "approved" ? "Approved" : "Changes requested"}
          </p>
          <h2 id={headingId} className="mt-1 font-[var(--font-editorial)] text-2xl font-medium text-[var(--ink-strong)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
          {resolved ? (
            <p className="mt-4 text-xs font-semibold text-[var(--ink)]">
              {status === "approved" ? "Approved" : "Returned"}{resolvedBy ? ` by ${resolvedBy}` : ""}
            </p>
          ) : onApprove || onRequestChanges ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {onApprove ? <Button type="button" onClick={onApprove}>Approve</Button> : null}
              {onRequestChanges ? <Button type="button" variant="outline" onClick={onRequestChanges}>Request changes</Button> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
