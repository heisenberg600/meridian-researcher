import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { DEFAULT_BRAND_PROFILE } from "./brandProfiles";
import { requireStudyAccess } from "./lib/auth";
import type { ReportBrandSnapshot, ReportSection } from "../src/features/report/reportDocument";

const sectionValidator = v.object({
  id: v.string(),
  kind: v.string(),
  title: v.string(),
  summary: v.string(),
  body: v.array(v.string()),
  claims: v.array(v.object({ id: v.string(), text: v.string(), findingIds: v.array(v.string()) })),
});

export function assertReportSectionUpdate(original: ReportSection, update: ReportSection, findingIds?: ReadonlySet<string>): ReportSection {
  if (update.id !== original.id || update.kind !== original.kind) throw new Error("Report section identity cannot be changed");
  const title = update.title.trim();
  if (!title) throw new Error("Report section requires a title");
  for (const claim of update.claims) {
    if (!claim.text.trim()) throw new Error(`Claim ${claim.id} requires text`);
    if (!claim.findingIds.length) throw new Error(`Claim ${claim.id} must reference at least one finding`);
    if (findingIds && claim.findingIds.some((id) => !findingIds.has(id))) throw new Error(`Claim ${claim.id} references an unknown finding`);
  }
  return structuredClone({ ...update, title, summary: update.summary.trim(), body: update.body.map((line) => line.trim()).filter(Boolean) });
}

export const getReport = query({
  args: { reportVersionId: v.id("reportVersions") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportVersionId);
    if (!report) return null;
    await requireStudyAccess(ctx, report.studyId);
    return report;
  },
});

export const listReports = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    return await ctx.db.query("reportVersions").withIndex("by_study", (q) => q.eq("studyId", args.studyId)).order("desc").collect();
  },
});

export const updateReportSection = mutation({
  args: { reportVersionId: v.id("reportVersions"), sectionId: v.string(), section: sectionValidator },
  handler: async (ctx, args) => {
    const report = await requireReportAccess(ctx, args.reportVersionId);
    if (report.status !== "ready" && report.status !== "draft") throw new Error("Only an unpublished report can be edited");
    const document = structuredClone(report.document) as { sections: ReportSection[] };
    const index = document.sections.findIndex((section) => section.id === args.sectionId);
    if (index < 0) throw new Error("Report section not found");
    const findingIds = new Set((report.analysisSnapshot as { findings: Array<{ id: string }> }).findings.map((finding) => String(finding.id)));
    document.sections[index] = assertReportSectionUpdate(document.sections[index]!, args.section as ReportSection, findingIds);
    await ctx.db.patch(report._id, { document, sections: document.sections, updatedAt: Date.now() });
    return report._id;
  },
});

export const publishReport = mutation({
  args: { reportVersionId: v.id("reportVersions") },
  handler: async (ctx, args) => {
    const report = await requireReportAccess(ctx, args.reportVersionId);
    if (report.status === "published") return report._id;
    if (report.status !== "ready" || !report.pdfStorageId || !report.pptxStorageId) throw new Error("Report exports must be ready before publishing");
    const { user } = await requireStudyAccess(ctx, report.studyId);
    const now = Date.now();
    await ctx.db.patch(report._id, { status: "published", publishedBy: user._id, publishedAt: now, updatedAt: now });
    await ctx.db.patch(report.studyId, { status: "completed", updatedAt: now });
    return report._id;
  },
});

export const getReportDownloadUrl = query({
  args: { reportVersionId: v.id("reportVersions"), format: v.union(v.literal("pdf"), v.literal("pptx")) },
  handler: async (ctx, args) => {
    const report = await requireReportAccess(ctx, args.reportVersionId);
    if (report.status !== "ready" && report.status !== "published") throw new Error("Report export is not ready");
    const storageId = args.format === "pdf" ? report.pdfStorageId : report.pptxStorageId;
    if (!storageId) throw new Error(`${args.format.toUpperCase()} export is not available`);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Report export is no longer available");
    return { url, filename: `research-report-v${report.version}.${args.format}` };
  },
});

export const beginReport = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const { study, user } = await requireStudyAccess(ctx, args.studyId);
    const analysis = await ctx.db.query("analysisRuns").withIndex("by_study", (q) => q.eq("studyId", args.studyId)).order("desc").first();
    if (!analysis || analysis.status !== "completed" || !analysis.summary || !analysis.completedAt) throw new Error("A completed analysis is required to generate a report");
    const findings = await ctx.db.query("findings").withIndex("by_analysis", (q) => q.eq("analysisRunId", analysis._id)).collect();
    if (!findings.length) throw new Error("A report requires at least one evidence-linked finding");
    const invalidFinding = findings.find((finding) => !finding.supportingEvidenceIds.length || finding.supportingEvidenceIds.some((id) => !analysis.evidenceIds.includes(id)) || finding.conflictingEvidenceIds.some((id) => !analysis.evidenceIds.includes(id)));
    if (invalidFinding) throw new Error("Report findings must reference evidence in the immutable analysis snapshot");
    const brand = await ctx.db.query("brandProfiles").withIndex("by_organization", (q) => q.eq("organizationId", study.organizationId)).unique();
    const existing = await ctx.db.query("reportVersions").withIndex("by_study", (q) => q.eq("studyId", args.studyId)).collect();
    const version = Math.max(0, ...existing.map((report) => report.version)) + 1;
    const analysisSnapshot = { runId: analysis._id, summary: analysis.summary, completedAt: analysis.completedAt, findings: findings.map((finding) => ({ id: finding._id, title: finding.title, narrative: finding.narrative, findingType: finding.findingType, strength: finding.strength, supportingEvidenceIds: finding.supportingEvidenceIds, conflictingEvidenceIds: finding.conflictingEvidenceIds, segment: finding.segment })) };
    const brandSnapshot: ReportBrandSnapshot = { ...DEFAULT_BRAND_PROFILE, ...(brand ? { displayName: brand.displayName, primaryColor: brand.primaryColor, accentColor: brand.accentColor, tone: brand.tone === "warm" || brand.tone === "direct" ? brand.tone : "precise", reportTitle: brand.reportTitle ?? DEFAULT_BRAND_PROFILE.reportTitle, reportFooter: brand.reportFooter ?? DEFAULT_BRAND_PROFILE.reportFooter, headingFont: brand.headingFont ?? DEFAULT_BRAND_PROFILE.headingFont, bodyFont: brand.bodyFont ?? DEFAULT_BRAND_PROFILE.bodyFont, logoStorageId: brand.logoStorageId, logoName: brand.logoName } : {}) };
    const now = Date.now();
    const reportVersionId = await ctx.db.insert("reportVersions", { organizationId: study.organizationId, studyId: study._id, analysisRunId: analysis._id, version, document: {}, brandSnapshot, analysisSnapshot, sections: [], status: "generating", generatedBy: user._id, createdAt: now, updatedAt: now });
    return { reportVersionId, organizationId: study.organizationId, study: { id: study._id, title: study.title, businessDecision: study.businessDecision }, analysisSnapshot, brandSnapshot, generatedAt: now };
  },
});

export const attachReservation = internalMutation({ args: { reportVersionId: v.id("reportVersions"), reservationId: v.id("creditReservations") }, handler: async (ctx, args) => { await ctx.db.patch(args.reportVersionId, { reservationId: args.reservationId, updatedAt: Date.now() }); } });
export const completeReport = internalMutation({ args: { reportVersionId: v.id("reportVersions"), document: v.any(), pdfStorageId: v.id("_storage"), pptxStorageId: v.id("_storage"), finalizedCredits: v.number() }, handler: async (ctx, args) => { const report = await ctx.db.get(args.reportVersionId); if (!report) throw new Error("Report not found"); await ctx.db.patch(report._id, { document: args.document, sections: args.document.sections, pdfStorageId: args.pdfStorageId, pptxStorageId: args.pptxStorageId, finalizedCredits: args.finalizedCredits, status: "ready", updatedAt: Date.now() }); await ctx.db.patch(report.studyId, { status: "report_ready", updatedAt: Date.now() }); } });
export const failReport = internalMutation({ args: { reportVersionId: v.id("reportVersions"), error: v.string() }, handler: async (ctx, args) => { await ctx.db.patch(args.reportVersionId, { status: "failed", error: args.error, updatedAt: Date.now() }); } });

async function requireReportAccess(ctx: Parameters<typeof requireStudyAccess>[0], reportVersionId: Id<"reportVersions">) {
  const report = await ctx.db.get(reportVersionId);
  if (!report) throw new Error("Report not found");
  await requireStudyAccess(ctx, report.studyId);
  return report;
}
