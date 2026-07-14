import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ReportDocument } from "./reportDocument";
import { planReportPages } from "./reportLayout";

export async function renderReportPdf(document: ReportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const heading = await pdf.embedFont(document.brandSnapshot.headingFont === "serif" ? StandardFonts.TimesRoman : StandardFonts.HelveticaBold);
  const primary = color(document.brandSnapshot.primaryColor);
  const accent = color(document.brandSnapshot.accentColor);
  const pages = planReportPages(document);
  pages.forEach((layout, index) => {
    const page = pdf.addPage([layout.width, layout.height]);
    page.drawRectangle({ x: 0, y: layout.height - 12, width: layout.width, height: 12, color: accent });
    page.drawText(document.brandSnapshot.displayName, { x: 48, y: layout.height - 48, size: 10, font: body, color: primary });
    for (const block of layout.blocks) {
      const size = block.kind === "title" ? 26 : block.kind === "evidence" ? 8 : block.kind === "summary" ? 13 : 11;
      const font = block.kind === "title" ? heading : body;
      const width = layout.width - 96;
      const lines = wrap(block.text, font.widthOfTextAtSize.bind(font), size, width);
      lines.forEach((line, lineIndex) => page.drawText(line, {
        x: block.kind === "evidence" ? 62 : 48,
        y: layout.height - block.y - size - lineIndex * (size * 1.35),
        size,
        font,
        color: block.kind === "evidence" ? accent : primary,
      }));
    }
    page.drawText(`${document.brandSnapshot.reportFooter}  |  ${index + 1}`, { x: 48, y: 28, size: 8, font: body, color: primary });
  });
  return await pdf.save({ useObjectStreams: false });
}

function wrap(text: string, measure: (value: string, size: number) => number, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/[\r\n]+/g, " ").split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate, size) > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function color(value: string) {
  const hex = value.replace("#", "");
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}
