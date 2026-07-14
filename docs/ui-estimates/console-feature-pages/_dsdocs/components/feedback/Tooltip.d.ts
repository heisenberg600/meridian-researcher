export interface TooltipProps {
  /** Short text label — a few words, sentence case. */
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}
export declare function Tooltip(props: TooltipProps): JSX.Element;
