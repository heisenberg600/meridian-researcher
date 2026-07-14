import * as React from "react";

/**
 * One saved payment method in a billing list — brand plate (text, no card
 * logos), masked number, expiry, default badge, hover-revealed actions.
 */
export interface PaymentMethodRowProps {
  /** e.g. "visa", "amex", "upi", "dodo" — rendered as a small mono text plate */
  brand: string;
  last4: string;
  /** e.g. "08/27" */
  expiry?: string;
  isDefault?: boolean;
  onRemove?: () => void;
  onMakeDefault?: () => void;
  style?: React.CSSProperties;
}

export declare function PaymentMethodRow(props: PaymentMethodRowProps): React.ReactElement;
