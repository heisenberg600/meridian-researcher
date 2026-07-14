export interface InputProps {
  label?: string;
  /** Muted helper line under the field. */
  hint?: string;
  /** Error message; replaces hint and turns the border red. */
  error?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  type?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export declare function Input(props: InputProps): JSX.Element;
