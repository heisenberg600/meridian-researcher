import * as React from "react";

/**
 * One row in the cross-project activity feed / notification list.
 * Kind picks the glyph + tint: input (needs you), research (report ready),
 * form (response received), call (call picked up / booked), system.
 */
export interface ActivityItemProps {
  kind?: "input" | "research" | "form" | "call" | "system";
  title: string;
  detail?: string;
  /** Project pill, e.g. "Churn study" */
  project?: string;
  /** e.g. "2m ago" */
  time?: string;
  unread?: boolean;
  /** Inline action label, e.g. "Review" — renders a small secondary button */
  action?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}

export declare function ActivityItem(props: ActivityItemProps): React.ReactElement;
