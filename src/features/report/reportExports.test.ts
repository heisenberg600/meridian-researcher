import fixture from "../../../tests/fixtures/report-study.json";
import { expect, it } from "vitest";
import { createReportDocument, type CreateReportInput } from "./reportDocument";
import { planReportPages } from "./reportLayout";
import { renderReportPdf } from "./renderPdf";
import { renderReportPptx } from "./renderPptx";

it("renders bounded PDF and PPTX exports from the same evidence-linked document", async () => {
  const document = createReportDocument(fixture as CreateReportInput);
  const pages = planReportPages(document);
  expect(pages.every((page) => page.blocks.every((block) => block.y >= 0 && block.y + block.height <= page.height))).toBe(true);

  const [pdf, pptx] = await Promise.all([renderReportPdf(document), renderReportPptx(document)]);
  expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  expect(Array.from(pptx.slice(0, 2))).toEqual([0x50, 0x4b]);
  expect(pdf.byteLength).toBeGreaterThan(5_000);
  expect(pptx.byteLength).toBeGreaterThan(10_000);
});
