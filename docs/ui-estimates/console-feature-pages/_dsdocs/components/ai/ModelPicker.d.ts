import * as React from "react";

export interface ModelOption {
  id: string;
  name: string;
  /** One-line description shown in the menu */
  desc?: string;
  /** Small badge, e.g. "Recommended" */
  tag?: string;
}

/**
 * Compact model selector for chat composers and headers.
 * Quiet trigger; menu opens upward (composer placement).
 */
export interface ModelPickerProps {
  models?: ModelOption[];
  value?: string;
  onChange?: (id: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export declare function ModelPicker(props: ModelPickerProps): React.ReactElement;
