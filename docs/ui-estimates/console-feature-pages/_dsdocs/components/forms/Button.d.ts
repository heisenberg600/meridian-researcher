/**
 * @startingPoint section="Forms" subtitle="Primary, secondary, ghost and danger actions" viewport="360x120"
 */
export interface ButtonProps {
  /** Visual weight. Default "primary" — one primary per view. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Control height: sm 28px, md 36px, lg 44px. Default "md". */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Optional 16px icon element rendered before the label. */
  iconLeft?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}
export declare function Button(props: ButtonProps): JSX.Element;
