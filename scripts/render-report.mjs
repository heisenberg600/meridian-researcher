import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import { createReportDocument } from "../src/features/report/reportDocument.ts";
import { renderReportPdf } from "../src/features/report/renderPdf.ts";
import { renderReportPptx } from "../src/features/report/renderPptx.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = JSON.parse(await readFile(new URL("../tests/fixtures/report-study.json", import.meta.url), "utf8"));
const document = createReportDocument(fixture);
const [pdf, pptx] = await Promise.all([renderReportPdf(document), renderReportPptx(document)]);

await mkdir(`${root}/output/pdf`, { recursive: true });
await mkdir(`${root}/output/pptx`, { recursive: true });
await writeFile(`${root}/output/pdf/fixture-research-report.pdf`, pdf);
await writeFile(`${root}/output/pptx/fixture-research-report.pptx`, pptx);
process.stdout.write(`Rendered ${document.sections.length} sections to PDF (${pdf.byteLength} bytes) and PPTX (${pptx.byteLength} bytes).\n`);
