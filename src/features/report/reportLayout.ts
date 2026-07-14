import type { ReportDocument } from "./reportDocument";

export type ReportLayoutBlock = { kind: "title" | "summary" | "body" | "claim" | "evidence"; text: string; y: number; height: number };
export type ReportLayoutPage = { sectionId: string; sectionKind: string; width: number; height: number; blocks: ReportLayoutBlock[] };

export function planReportPages(document: ReportDocument): ReportLayoutPage[] {
  return document.sections.flatMap((section) => {
    const items: Array<Pick<ReportLayoutBlock, "kind" | "text">> = [
      { kind: "title", text: section.title },
      { kind: "summary", text: section.summary },
      ...section.body.map((text) => ({ kind: "body" as const, text })),
      ...section.claims.flatMap((claim) => [
        { kind: "claim" as const, text: claim.text },
        { kind: "evidence" as const, text: `Evidence: ${claim.findingIds.join(", ")}` },
      ]),
    ];
    const pages: ReportLayoutPage[] = [];
    let page = newPage(section.id, section.kind);
    let y = 92;
    for (const item of items) {
      const height = blockHeight(item.kind, item.text);
      if (y + height > 724 && page.blocks.length > 0) {
        pages.push(page);
        page = newPage(section.id, section.kind);
        y = 92;
      }
      page.blocks.push({ ...item, y, height });
      y += height + (item.kind === "evidence" ? 18 : 12);
    }
    pages.push(page);
    return pages;
  });
}

function newPage(sectionId: string, sectionKind: string): ReportLayoutPage {
  return { sectionId, sectionKind, width: 612, height: 792, blocks: [] };
}

function blockHeight(kind: ReportLayoutBlock["kind"], text: string) {
  const chars = kind === "title" ? 32 : kind === "evidence" ? 76 : 68;
  const line = kind === "title" ? 31 : kind === "evidence" ? 13 : 19;
  return Math.max(line, Math.ceil(text.length / chars) * line);
}
