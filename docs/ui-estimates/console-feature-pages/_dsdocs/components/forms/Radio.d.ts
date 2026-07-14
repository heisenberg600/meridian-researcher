export interface RadioProps {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: React.SyntheticEvent) => void;
}
export declare function Radio(props: RadioProps): JSX.Element;

export interface RadioGroupProps {
  options: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  direction?: "column" | "row";
}
export declare function RadioGroup(props: RadioGroupProps): JSX.Element;
