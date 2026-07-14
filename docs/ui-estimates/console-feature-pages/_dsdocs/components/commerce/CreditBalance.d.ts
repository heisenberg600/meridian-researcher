import * as React from "react";

/**
 * Credit balance display for billing pages and topbars — big serif figure,
 * usage note, low-balance warning, and an "Add credits" action.
 */
export interface CreditBalanceProps {
  balance?: number;
  /** e.g. "credits", "USD" */
  unit?: string;
  usedThisMonth?: number;
  /** Muted caption, e.g. "Auto-refills at 500 · Dodo Payments" */
  refreshNote?: string;
  /** Tints the figure red and shows a warning */
  low?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  style?: React.CSSProperties;
}

export declare function CreditBalance(props: CreditBalanceProps): React.ReactElement;
