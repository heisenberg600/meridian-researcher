export interface TagProps {
  /** When provided, renders a small × remove affordance. */
  onRemove?: () => void;
  children: React.ReactNode;
}
export declare function Tag(props: TagProps): JSX.Element;
