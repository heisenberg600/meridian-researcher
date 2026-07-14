import fixture from "../../../tests/fixtures/report-study.json";
import { describe, expect, it } from "vitest";

import {
  REPORT_SECTION_KINDS,
  createReportDocument,
  type CreateReportInput,
  validateReportDocument,
} from "./reportDocument";

const inputFixture = fixture as CreateReportInput;

describe("structured report document", () => {
  it("creates the nine ordered report sections from an immutable analysis and brand snapshot", () => {
    const input = structuredClone(inputFixture);
    const document = createReportDocument(input);

    expect(document.sections.map((section) => section.kind)).toEqual(REPORT_SECTION_KINDS);
    expect(document.analysisSnapshot.runId).toBe("analysis-fixture-v3");
    expect(document.analysisSnapshot.findings).not.toBe(input.analysis.findings);
    expect(document.brandSnapshot).toEqual(fixture.brand);

    input.analysis.findings[0]!.title = "Mutated after generation";
    input.brand.primaryColor = "#FFFFFF";
    expect(document.analysisSnapshot.findings[0]!.title).toContain("Fast orientation");
    expect(document.brandSnapshot.primaryColor).toBe("#173A45");
  });

  it("links every substantive report claim to findings in the snapshotted analysis", () => {
    const document = createReportDocument(inputFixture);
    expect(validateReportDocument(document)).toEqual([]);

    const claims = document.sections.flatMap((section) => section.claims);
    expect(claims.length).toBeGreaterThan(0);
    expect(claims.every((claim) => claim.findingIds.length > 0)).toBe(true);
    const knownFindings = new Set(document.analysisSnapshot.findings.map((finding) => finding.id));
    expect(claims.every((claim) => claim.findingIds.every((id) => knownFindings.has(id)))).toBe(true);
  });

  it("rejects missing, duplicated, reordered, and ungrounded sections or claims", () => {
    const document = createReportDocument(inputFixture);
    const invalid = structuredClone(document);
    invalid.sections[1]!.kind = "appendix";
    invalid.sections[2]!.claims[0]!.findingIds = ["finding-not-in-snapshot"];
    invalid.sections[3]!.claims.push({ id: "empty-proof", text: "A claim without evidence", findingIds: [] });

    expect(validateReportDocument(invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining("section 2"),
      expect.stringContaining("finding-not-in-snapshot"),
      expect.stringContaining("at least one finding"),
    ]));
  });
});
