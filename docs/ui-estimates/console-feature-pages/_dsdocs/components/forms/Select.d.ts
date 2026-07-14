export interface SelectProps {
  label?: string;
  /** Strings or { value, label } pairs. */
  options: Array<string | { value: string; label: string }>;
  value?: string;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}
export declare function Select(props: SelectProps): JSX.Element;
