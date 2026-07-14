import * as React from "react";
import { SourceChipProps } from "./SourceChip";

/**
 * One message in an agent conversation.
 * User messages render as a right-aligned ivory bubble;
 * assistant messages render full-width with a monogram marker.
 */
export interface ChatMessageProps {
  role?: "user" | "assistant";
  /** Assistant display name; first letter becomes the monogram */
  author?: string;
  time?: string;
  /** Citation chips rendered under the message body */
  sources?: SourceChipProps[];
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function ChatMessage(props: ChatMessageProps): React.ReactElement;
