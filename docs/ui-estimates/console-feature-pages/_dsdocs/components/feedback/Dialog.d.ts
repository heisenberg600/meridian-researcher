export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  /** Serif dialog title. */
  title?: string;
  /** Right-aligned action row, typically Cancel + primary Button. */
  footer?: React.ReactNode;
  /** Pixel width. Default 440. */
  width?: number;
  children?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
