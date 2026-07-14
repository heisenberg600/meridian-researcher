import pptxgen from "pptxgenjs";
import type { ReportDocument } from "./reportDocument";
import { planReportPages } from "./reportLayout";

export async function renderReportPptx(document: ReportDocument): Promise<Uint8Array> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = document.brandSnapshot.displayName;
  pptx.subject = document.study.businessDecision;
  pptx.title = document.title;
  const pages = planReportPages(document);
  for (const [index, page] of pages.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: "FAF9F6" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, line: { color: document.brandSnapshot.accentColor.slice(1), transparency: 100 }, fill: { color: document.brandSnapshot.accentColor.slice(1) } });
    slide.addText(document.brandSnapshot.displayName, { x: 0.7, y: 0.35, w: 5, h: 0.25, fontFace: "Arial", fontSize: 9, color: document.brandSnapshot.primaryColor.slice(1), margin: 0 });
    for (const block of page.blocks) {
      const y = block.y / page.height * 6.65;
      const h = Math.max(block.height / page.height * 6.65, 0.18);
      slide.addText(block.text, {
        x: block.kind === "evidence" ? 1 : 0.7,
        y,
        w: block.kind === "evidence" ? 11.6 : 11.9,
        h,
        fontFace: block.kind === "title" && document.brandSnapshot.headingFont === "serif" ? "Georgia" : "Arial",
        fontSize: block.kind === "title" ? 28 : block.kind === "evidence" ? 9 : block.kind === "summary" ? 16 : 13,
        bold: block.kind === "title",
        color: (block.kind === "evidence" ? document.brandSnapshot.accentColor : document.brandSnapshot.primaryColor).slice(1),
        margin: 0,
        breakLine: false,
        valign: "top",
        fit: "shrink",
      });
    }
    slide.addText(`${document.brandSnapshot.reportFooter}  |  ${index + 1}`, { x: 0.7, y: 7.15, w: 11.9, h: 0.18, fontFace: "Arial", fontSize: 8, color: document.brandSnapshot.primaryColor.slice(1), margin: 0 });
  }
  const output = await pptx.write({ outputType: "nodebuffer", compression: true });
  return new Uint8Array(output as ArrayBuffer);
}
