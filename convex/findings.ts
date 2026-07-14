export const analysisViewTypes = [
  "question",
  "segment",
  "theme",
  "contradiction",
  "limitation",
] as const;

export type AnalysisViewType = (typeof analysisViewTypes)[number];
export type FindingStrength = "emerging" | "supported" | "strong";
export type FindingDraft = {
  viewType: AnalysisViewType;
  title: string;
  narrative: string;
  strength: FindingStrength;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  questionId?: string;
  segment?: string;
};

export function validateFindingDrafts(
  findings: FindingDraft[],
  snapshotEvidenceIds: ReadonlySet<string>,
): FindingDraft[] {
  return findings.map((finding, index) => {
    if (!analysisViewTypes.includes(finding.viewType)) {
      throw new Error(`Finding ${index + 1} has an invalid analysis view`);
    }
    if (!finding.title.trim() || !finding.narrative.trim()) {
      throw new Error(`Finding ${index + 1} must include a title and narrative`);
    }
    if (!finding.supportingEvidenceIds.length) {
      throw new Error(`Finding ${index + 1} must contain at least one supporting evidence ID`);
    }
    const referenced = [...finding.supportingEvidenceIds, ...finding.conflictingEvidenceIds];
    if (referenced.some((id) => !snapshotEvidenceIds.has(id))) {
      throw new Error(`Finding ${index + 1} references evidence outside the response snapshot`);
    }
    if (finding.viewType === "contradiction" && !finding.conflictingEvidenceIds.length) {
      throw new Error(`Contradiction finding ${index + 1} must include conflicting evidence`);
    }
    return {
      ...finding,
      title: finding.title.trim(),
      narrative: finding.narrative.trim(),
      supportingEvidenceIds: unique(finding.supportingEvidenceIds),
      conflictingEvidenceIds: unique(finding.conflictingEvidenceIds),
    };
  });
}

export function validateAnalysisResponse(
  value: unknown,
  snapshotEvidenceIds: ReadonlySet<string>,
): { summary: string; findings: FindingDraft[] } {
  if (!value || typeof value !== "object") throw new Error("Analysis response must be an object");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.summary !== "string" || !candidate.summary.trim()) {
    throw new Error("Analysis response must include a summary");
  }
  if (!Array.isArray(candidate.findings)) throw new Error("Analysis response must include findings");
  const findings = validateFindingDrafts(candidate.findings.map(parseFinding), snapshotEvidenceIds);
  const presentViews = new Set(findings.map((finding) => finding.viewType));
  const missingViews = analysisViewTypes.filter((view) => !presentViews.has(view));
  if (missingViews.length) {
    throw new Error(`Analysis response is missing ${missingViews.join(", ")} views`);
  }
  return { summary: candidate.summary.trim(), findings };
}

function parseFinding(value: unknown, index: number): FindingDraft {
  if (!value || typeof value !== "object") throw new Error(`Finding ${index + 1} must be an object`);
  const finding = value as Record<string, unknown>;
  return {
    viewType: String(finding.viewType ?? "") as AnalysisViewType,
    title: String(finding.title ?? ""),
    narrative: String(finding.narrative ?? ""),
    strength: String(finding.strength ?? "") as FindingStrength,
    supportingEvidenceIds: stringArray(finding.supportingEvidenceIds),
    conflictingEvidenceIds: stringArray(finding.conflictingEvidenceIds),
    questionId: optionalString(finding.questionId),
    segment: optionalString(finding.segment),
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return [];
  return value as string[];
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export const listFindings = query({
  args: { studyId: v.id("studies"), analysisRunId: v.optional(v.id("analysisRuns")) },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    const findings = args.analysisRunId
      ? await ctx.db.query("findings").withIndex("by_analysis", (q) => q.eq("analysisRunId", args.analysisRunId!)).collect()
      : await ctx.db.query("findings").withIndex("by_study", (q) => q.eq("studyId", args.studyId)).collect();
    return findings.filter((finding) => finding.studyId === args.studyId);
  },
});
import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";
