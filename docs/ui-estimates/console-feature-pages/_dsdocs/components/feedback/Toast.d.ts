export interface ToastProps {
  /** "success"/"danger" add a small status dot; "neutral" is plain. */
  tone?: "neutral" | "success" | "danger";
  /** Optional trailing action (e.g. a ghost Button "Undo"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}
export declare function Toast(props: ToastProps): JSX.Element;
