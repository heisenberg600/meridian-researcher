export interface TabItem { id: string; label: string; count?: number; }
export interface TabsProps {
  /** Strings or { id, label, count } objects. */
  items: Array<string | TabItem>;
  /** Active tab id. */
  value: string;
  onChange?: (id: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;
