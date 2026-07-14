import * as React from "react";

/**
 * Right-side document canvas — opens next to a chat thread so the user can
 * read a PDF, questionnaire, or sheet without leaving the conversation.
 * No in-canvas editing: the user copies content or selects it and gives
 * feedback in the chat (footer hint says so).
 */
export interface CanvasPanelProps {
  title: string;
  /** Muted suffix, e.g. "PDF · 6 pages" */
  meta?: string;
  kind?: "file" | "sheet";
  /** Renders a "Copy contents" button with copied confirmation */
  onCopy?: () => void;
  onDownload?: () => void;
  onClose?: () => void;
  /** Footer microcopy; null hides the footer */
  footerHint?: string | null;
  /** Extra header actions before copy/close */
  toolbar?: React.ReactNode;
  /** Panel width, e.g. "44%" or 560 */
  width?: number | string;
  /** Document content: PdfPage(s), SheetGrid, or custom */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function CanvasPanel(props: CanvasPanelProps): React.ReactElement;
