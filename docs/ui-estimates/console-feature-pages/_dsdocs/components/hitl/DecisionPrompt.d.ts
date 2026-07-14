import * as React from "react";

export interface DecisionOption {
  id: string;
  label: string;
}

/**
 * Structured human-input prompt the agent posts in a thread:
 * a question with tappable option chips (single or multi) and a confirm button.
 */
export interface DecisionPromptProps {
  question: string;
  options?: (DecisionOption | string)[];
  multi?: boolean;
  /** Selected id (single) or ids (multi) */
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  onSubmit?: () => void;
  submitLabel?: string;
  /** Locks the chips and hides the confirm row */
  resolved?: boolean;
  style?: React.CSSProperties;
}

export declare function DecisionPrompt(props: DecisionPromptProps): React.ReactElement;
