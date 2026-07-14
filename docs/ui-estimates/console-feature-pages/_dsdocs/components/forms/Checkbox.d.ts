export interface CheckboxProps {
  label?: string;
  /** Controlled state; omit to let the component manage itself. */
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;
