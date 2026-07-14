/**
 * @startingPoint section="Display" subtitle="White surface card with optional title row" viewport="420x200"
 */
export interface CardProps {
  /** Optional 18px title row. */
  title?: string;
  /** Element rendered at the right of the title row (e.g. a ghost Button). */
  action?: React.ReactNode;
  /** Set false for flush content like tables. Default true (20px padding). */
  padded?: boolean;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
