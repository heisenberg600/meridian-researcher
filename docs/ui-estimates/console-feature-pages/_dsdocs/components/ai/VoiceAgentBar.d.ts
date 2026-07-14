import * as React from "react";

/**
 * Floating pill shown while a voice conversation with the agent is live:
 * animated level bars, status text, elapsed time, mute and end controls.
 */
export interface VoiceAgentBarProps {
  /** e.g. "Listening", "Speaking", "Thinking" */
  status?: string;
  /** Elapsed time, e.g. "02:14" */
  duration?: string;
  muted?: boolean;
  onMute?: () => void;
  onEnd?: () => void;
  style?: React.CSSProperties;
}

export declare function VoiceAgentBar(props: VoiceAgentBarProps): React.ReactElement;
