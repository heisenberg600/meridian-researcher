import * as React from "react";

/**
 * Small chip representing an attached document, link, or audio source.
 * Used in composer attachments, message citations, and knowledge lists.
 */
export interface SourceChipProps {
  name: string;
  /** Muted suffix, e.g. "PDF · 2.4 MB" */
  meta?: string;
  kind?: "file" | "link" | "audio";
  /** Renders an X button when provided */
  onRemove?: () => void;
  style?: React.CSSProperties;
}

export declare function SourceChip(props: SourceChipProps): React.ReactElement;
