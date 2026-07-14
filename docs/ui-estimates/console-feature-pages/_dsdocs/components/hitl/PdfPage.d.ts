import * as React from "react";

/**
 * One rendered page of a PDF inside a CanvasPanel — white sheet with
 * document margins on the sunken canvas background, page number below.
 */
export interface PdfPageProps {
  number?: number;
  of?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function PdfPage(props: PdfPageProps): React.ReactElement;
