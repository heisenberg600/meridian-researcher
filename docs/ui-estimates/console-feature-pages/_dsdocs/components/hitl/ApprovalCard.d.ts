import * as React from "react";

/**
 * Human-in-the-loop checkpoint the agent posts in a thread when it
 * needs sign-off before acting (send email, spend credits, publish).
 * Pending shows Approve/Decline; resolved shows a status badge.
 */
export interface ApprovalCardProps {
  title: string;
  description?: string;
  /** Small muted context, e.g. "Step 3 of 4 · Outreach agent" */
  meta?: string;
  status?: "pending" | "approved" | "declined";
  approveLabel?: string;
  declineLabel?: string;
  onApprove?: () => void;
  onDecline?: () => void;
  /** Shown next to the resolved badge, e.g. "by Dana · 2:41 PM" */
  resolvedNote?: string;
  /** Detail payload (diff, summary rows, SourceChips) */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function ApprovalCard(props: ApprovalCardProps): React.ReactElement;
