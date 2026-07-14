import * as React from "react";

/**
 * Spreadsheet rendering for a CanvasPanel — column letters, row numbers,
 * header row, and optional single-cell selection for copy/feedback flows.
 */
export interface SheetGridProps {
  /** Header labels (row 1) */
  columns?: string[];
  /** Data rows (row 2+), one string array per row */
  rows?: (string | number)[][];
  /** [rowIndex, colIndex] of the selected cell */
  selected?: [number, number] | null;
  onSelect?: (cell: [number, number]) => void;
  style?: React.CSSProperties;
}

export declare function SheetGrid(props: SheetGridProps): React.ReactElement;
