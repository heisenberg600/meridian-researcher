export interface BadgeProps {
  /** Status tone. Default "neutral". */
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  /** Leading 6px status dot. */
  dot?: boolean;
  children: React.ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;
