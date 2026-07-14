import * as React from "react";
import { SourceChipProps } from "./SourceChip";

/**
 * Message input for agent chat: auto-growing textarea, attach + voice
 * buttons, a toolbar slot (put a ModelPicker there), and a send button.
 * Enter sends; Shift+Enter adds a newline.
 */
export interface ChatComposerProps {
  placeholder?: string;
  /** Pending attachments shown as chips above the textarea */
  attachments?: SourceChipProps[];
  onSend?: (text: string) => void;
  onAttach?: () => void;
  onVoice?: () => void;
  /** Highlights the mic button while voice mode is on */
  voiceActive?: boolean;
  /** Extra toolbar content, rendered after the attach button (e.g. <ModelPicker/>) */
  toolbar?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function ChatComposer(props: ChatComposerProps): React.ReactElement;
