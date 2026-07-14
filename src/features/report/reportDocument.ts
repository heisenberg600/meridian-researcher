export const REPORT_SECTION_KINDS = [
  "cover",
  "executive_decision",
  "key_findings",
  "segment_differences",
  "counter_evidence",
  "recommendations",
  "methodology_sample",
  "limitations",
  "appendix",
] as const;

export type ReportSectionKind = (typeof REPORT_SECTION_KINDS)[number];

export type FindingSnapshot = {
  id: string;
  title: string;
  narrative: string;
  findingType: "theme" | "opportunity" | "risk" | "recommendation";
  strength: "emerging" | "supported" | "strong";
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  segment?: string;
};

export type AnalysisSnapshot = {
  runId: string;
  summary: string;
  completedAt: number;
  findings: FindingSnapshot[];
};

export type ReportBrandSnapshot = {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  tone: "precise" | "warm" | "direct";
  reportTitle: string;
  reportFooter: string;
  headingFont: "serif" | "sans";
  bodyFont: "serif" | "sans";
  logoStorageId?: string;
  logoName?: string;
};

export type ReportClaim = {
  id: string;
  text: string;
  findingIds: string[];
};

export type ReportSection = {
  id: string;
  kind: ReportSectionKind;
  title: string;
  summary: string;
  body: string[];
  claims: ReportClaim[];
};

export type ReportDocument = {
  schemaVersion: 1;
  study: { id: string; title: string; businessDecision: string };
  title: string;
  generatedAt: number;
  analysisSnapshot: AnalysisSnapshot;
  brandSnapshot: ReportBrandSnapshot;
  sections: ReportSection[];
};

export type CreateReportInput = {
  study: ReportDocument["study"];
  analysis: AnalysisSnapshot;
  brand: ReportBrandSnapshot;
  generatedAt: number;
};

const SECTION_TITLES: Record<ReportSectionKind, string> = {
  cover: "Decision brief",
  executive_decision: "Executive decision",
  key_findings: "Key findings",
  segment_differences: "Segment differences",
  counter_evidence: "Counter-evidence",
  recommendations: "Recommendations",
  methodology_sample: "Methodology and sample",
  limitations: "Limitations",
  appendix: "Evidence appendix",
};

export function createReportDocument(input: CreateReportInput): ReportDocument {
  const analysisSnapshot = clone(input.analysis);
  const brandSnapshot = clone(input.brand);
  const findings = analysisSnapshot.findings;
  if (findings.length === 0) throw new Error("A report requires at least one finding");

  const strongest = [...findings].sort((a, b) => strengthRank(b.strength) - strengthRank(a.strength));
  const segmented = findings.filter((finding) => finding.segment);
  const counter = findings.filter((finding) => finding.conflictingEvidenceIds.length > 0);
  const recommendations = findings.filter((finding) => finding.findingType === "recommendation" || finding.findingType === "opportunity");
  const evidenceCount = new Set(findings.flatMap((finding) => [...finding.supportingEvidenceIds, ...finding.conflictingEvidenceIds])).size;

  const sections: ReportSection[] = [
    section("cover", brandSnapshot.reportTitle, input.study.businessDecision, [
      `${input.study.title} - generated from analysis ${analysisSnapshot.runId}.`,
    ]),
    section("executive_decision", SECTION_TITLES.executive_decision, analysisSnapshot.summary, [], strongest.slice(0, 2).map((finding) => claimFromFinding(finding))),
    section("key_findings", SECTION_TITLES.key_findings, "The patterns with the clearest decision impact.", [], strongest.map((finding) => claimFromFinding(finding))),
    section(
      "segment_differences",
      SECTION_TITLES.segment_differences,
      segmented.length ? "Where the evidence changes by audience." : "No reliable segment difference was present in this analysis.",
      segmented.length ? [] : ["Treat the overall pattern as directional until the sample supports segment comparison."],
      segmented.map((finding) => claimFromFinding(finding)),
    ),
    section(
      "counter_evidence",
      SECTION_TITLES.counter_evidence,
      counter.length ? "Signals that qualify the leading interpretation." : "No conflicting evidence was tagged in the analysis.",
      [],
      counter.map((finding) => claimFromFinding(finding, `Counter-signal: ${finding.narrative}`)),
    ),
    section(
      "recommendations",
      SECTION_TITLES.recommendations,
      "Actions grounded in the current evidence, not a substitute for product judgment.",
      [],
      (recommendations.length ? recommendations : strongest.slice(0, 2)).map((finding) =>
        claimFromFinding(finding, recommendationText(finding)),
      ),
    ),
    section("methodology_sample", SECTION_TITLES.methodology_sample, `${findings.length} findings synthesized from ${evidenceCount} linked evidence records.`, [
      `Analysis run ${analysisSnapshot.runId} completed ${new Date(analysisSnapshot.completedAt).toISOString()}.`,
      "Counts describe linked records in the analysis snapshot and do not imply statistical representativeness.",
    ]),
    section("limitations", SECTION_TITLES.limitations, "Read the conclusions within the boundaries of the available sample.", [
      "Finding strength reflects the completed analysis snapshot; later fieldwork is not included.",
      "Segment comparisons are directional when only a small number of evidence records are linked.",
    ]),
    section("appendix", SECTION_TITLES.appendix, "Finding and evidence identifiers retained for review.", findings.map((finding) =>
      `${finding.id}: ${[...finding.supportingEvidenceIds, ...finding.conflictingEvidenceIds].join(", ") || "No evidence IDs"}`,
    )),
  ];

  const document: ReportDocument = {
    schemaVersion: 1,
    study: clone(input.study),
    title: brandSnapshot.reportTitle,
    generatedAt: input.generatedAt,
    analysisSnapshot,
    brandSnapshot,
    sections,
  };
  const errors = validateReportDocument(document);
  if (errors.length) throw new Error(errors.join("; "));
  return document;
}

export function validateReportDocument(document: ReportDocument): string[] {
  const errors: string[] = [];
  if (document.schemaVersion !== 1) errors.push("Unsupported report schema version");
  if (document.sections.length !== REPORT_SECTION_KINDS.length) {
    errors.push(`Report must contain ${REPORT_SECTION_KINDS.length} sections`);
  }
  for (const [index, expected] of REPORT_SECTION_KINDS.entries()) {
    if (document.sections[index]?.kind !== expected) {
      errors.push(`Report section ${index + 1} must be ${expected}`);
    }
  }
  const findingIds = new Set(document.analysisSnapshot.findings.map((finding) => finding.id));
  for (const section of document.sections) {
    if (!section.title.trim()) errors.push(`${section.kind} requires a title`);
    for (const claim of section.claims) {
      if (!claim.text.trim()) errors.push(`Claim ${claim.id} requires text`);
      if (claim.findingIds.length === 0) errors.push(`Claim ${claim.id} must reference at least one finding`);
      for (const findingId of claim.findingIds) {
        if (!findingIds.has(findingId)) errors.push(`Claim ${claim.id} references unknown finding ${findingId}`);
      }
    }
  }
  return errors;
}

function section(
  kind: ReportSectionKind,
  title: string,
  summary: string,
  body: string[],
  claims: ReportClaim[] = [],
): ReportSection {
  return { id: `section-${kind}`, kind, title, summary, body, claims };
}

function claimFromFinding(finding: FindingSnapshot, text = finding.narrative): ReportClaim {
  return { id: `claim-${finding.id}`, text, findingIds: [finding.id] };
}

function recommendationText(finding: FindingSnapshot) {
  if (finding.findingType === "risk") return `Mitigate this risk before launch: ${finding.narrative}`;
  return `Act on this signal: ${finding.narrative}`;
}

function strengthRank(strength: FindingSnapshot["strength"]) {
  return { emerging: 0, supported: 1, strong: 2 }[strength];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
