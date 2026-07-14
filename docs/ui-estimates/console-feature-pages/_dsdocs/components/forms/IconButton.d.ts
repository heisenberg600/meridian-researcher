export interface IconButtonProps {
  /** "ghost" (default) or "secondary" (bordered). */
  variant?: "ghost" | "secondary";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Required — icon-only controls must be labeled (also used as tooltip). */
  "aria-label": string;
  /** A 16–20px icon element. */
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
