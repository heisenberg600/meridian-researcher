import * as React from "react";

export interface AgentStep {
  /** Agent name, e.g. "Research agent" */
  agent: string;
  /** What it's doing / did, e.g. "Reading 12 survey responses" */
  detail?: string;
  state?: "done" | "working" | "waiting" | "queued";
  /** Renders a handoff arrow: "from Research agent" */
  handoffFrom?: string;
  /** e.g. "1m 40s" or "2:41 PM" */
  time?: string;
}

/**
 * Live view of multi-agent orchestration inside a thread: which agent is
 * working (spinner + shimmering label), which handed off to which, which is
 * waiting on the human, which are queued.
 */
export interface AgentTimelineProps {
  steps?: AgentStep[];
  /** Tighter padding for embedding in a message stream */
  compact?: boolean;
  style?: React.CSSProperties;
}

export declare function AgentTimeline(props: AgentTimelineProps): React.ReactElement;
