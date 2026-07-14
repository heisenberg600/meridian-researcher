import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { calculateBillableCredits } from "./lib/billing";
import { requireStudyAccess } from "./lib/auth";
import { validateAnalysisResponse } from "./findings";

export type AnalysisSnapshotKind = "provisional" | "final";

export function snapshotKindForStudyStatus(status: string): AnalysisSnapshotKind {
  return status === "fieldwork_running" ? "provisional" : "final";
}

export function normalizeProviderUsage(value: unknown): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  if (!value || typeof value !== "object") throw new Error("Provider did not return exact usage");
  const usage = value as Record<string, unknown>;
  const inputTokens = usage.prompt_tokens;
  const outputTokens = usage.completion_tokens;
  const totalTokens = usage.total_tokens;
  for (const [name, count] of Object.entries({ inputTokens, outputTokens, totalTokens })) {
    if (!Number.isSafeInteger(count) || Number(count) < 0) {
      throw new Error(`Provider did not return exact ${name === "totalTokens" ? "total_tokens" : name}`);
    }
  }
  if (Number(totalTokens) < Number(inputTokens) + Number(outputTokens)) {
    throw new Error("Provider total_tokens cannot be lower than prompt and completion tokens");
  }
  return {
    inputTokens: Number(inputTokens),
    outputTokens: Number(outputTokens),
    totalTokens: Number(totalTokens),
  };
}

export function analysisMaximumCredits(maximumTokens: number) {
  return calculateBillableCredits({ operation: "analysis", nativeQuantity: maximumTokens }).credits;
}

const MODEL = "openai/gpt-5-mini";
const PROVIDER = "vercel-ai-gateway";

export const startAnalysis = action({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args): Promise<{ analysisRunId: Id<"analysisRuns"> }> => {
    await ctx.runMutation(internal.evidence.normalizeStudy, args);
    const started = await ctx.runMutation(internal.analysisActions.beginAnalysis, args);
    let reservationId: Id<"creditReservations"> | undefined;
    try {
      const reservation = await ctx.runMutation(api.credits.reserveCredits, {
        organizationId: started.organizationId,
        studyId: args.studyId,
        operationId: started.analysisRunId,
        operation: "analysis",
        maximumCredits: started.maximumCredits,
        idempotencyKey: `analysis:${started.analysisRunId}`,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });
      reservationId = reservation.reservationId;
      await ctx.runMutation(internal.analysisActions.attachReservation, { analysisRunId: started.analysisRunId, reservationId });
      const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
      if (!apiKey) throw new Error("AI_GATEWAY_API_KEY is not configured");
      const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, temperature: 0.15, response_format: { type: "json_object" }, messages: [
          { role: "system", content: analysisSystemPrompt() },
          { role: "user", content: JSON.stringify({ snapshotKind: started.snapshotKind, evidence: started.evidence }) },
        ] }),
      });
      if (!response.ok) throw new Error(`Analysis provider failed (${response.status})`);
      const payload = await response.json();
      const usage = normalizeProviderUsage(payload.usage);
      const parsed = JSON.parse(String(payload?.choices?.[0]?.message?.content ?? "{}"));
      const analysis = validateAnalysisResponse(parsed, new Set(started.evidence.map((item) => item.id)));
      const providerOperationId = String(payload.id ?? `analysis-${started.analysisRunId}`);
      const settlement = await ctx.runMutation(internal.credits.reconcileUsage, {
        organizationId: started.organizationId,
        reservationId,
        provider: PROVIDER,
        providerOperationId,
        nativeQuantity: usage.totalTokens,
        internalCostMicros: 0,
        model: MODEL,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      });
      await ctx.runMutation(internal.analysisActions.completeAnalysis, {
        analysisRunId: started.analysisRunId,
        summary: analysis.summary,
        findings: analysis.findings.map((finding) => ({ ...finding, supportingEvidenceIds: finding.supportingEvidenceIds as Id<"responseEvidence">[], conflictingEvidenceIds: finding.conflictingEvidenceIds as Id<"responseEvidence">[] })),
        providerOperationId,
        usage,
        finalizedCredits: settlement.finalDebit,
      });
      return { analysisRunId: started.analysisRunId };
    } catch (error) {
      if (reservationId) await ctx.runMutation(internal.credits.releaseReservation, { organizationId: started.organizationId, reservationId, idempotencyKey: `analysis-failed:${started.analysisRunId}`, reason: "analysis_failed" }).catch(() => undefined);
      await ctx.runMutation(internal.analysisActions.failAnalysis, { analysisRunId: started.analysisRunId, error: error instanceof Error ? error.message : "Analysis failed" });
      throw error;
    }
  },
});

export const getAnalysis = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    return await ctx.db.query("analysisRuns").withIndex("by_study", (q) => q.eq("studyId", args.studyId)).order("desc").first();
  },
});

export const beginAnalysis = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const { study } = await requireStudyAccess(ctx, args.studyId);
    const evidence = await ctx.db.query("responseEvidence").withIndex("by_study", (q) => q.eq("studyId", args.studyId)).collect();
    if (!evidence.length) throw new Error("No completed participant responses are available for analysis");
    const snapshotKind = snapshotKindForStudyStatus(study.status);
    const now = Date.now();
    const analysisRunId = await ctx.db.insert("analysisRuns", { organizationId: study.organizationId, studyId: study._id, evidenceIds: evidence.map((item) => item._id), snapshotKind, status: "running", model: MODEL, provider: PROVIDER, createdAt: now, updatedAt: now });
    const maximumTokens = Math.max(4_000, Math.ceil(evidence.reduce((sum, item) => sum + item.excerpt.length, 0) / 2) + 4_000);
    return { analysisRunId, organizationId: study.organizationId, snapshotKind, maximumCredits: analysisMaximumCredits(maximumTokens), evidence: evidence.map((item) => ({ id: item._id, questionId: item.questionId, question: item.questionLabel, segment: item.segment, excerpt: item.excerpt, channel: item.channel, locator: item.answerLocator })) };
  },
});

export const attachReservation = internalMutation({ args: { analysisRunId: v.id("analysisRuns"), reservationId: v.id("creditReservations") }, handler: async (ctx, args) => { await ctx.db.patch(args.analysisRunId, { reservationId: args.reservationId, updatedAt: Date.now() }); } });

const findingValidator = v.object({ viewType: v.union(...(["question", "segment", "theme", "contradiction", "limitation"] as const).map(v.literal)), title: v.string(), narrative: v.string(), strength: v.union(v.literal("emerging"), v.literal("supported"), v.literal("strong")), supportingEvidenceIds: v.array(v.id("responseEvidence")), conflictingEvidenceIds: v.array(v.id("responseEvidence")), questionId: v.optional(v.string()), segment: v.optional(v.string()) });

export const completeAnalysis = internalMutation({ args: { analysisRunId: v.id("analysisRuns"), summary: v.string(), findings: v.array(findingValidator), providerOperationId: v.string(), usage: v.object({ inputTokens: v.number(), outputTokens: v.number(), totalTokens: v.number() }), finalizedCredits: v.number() }, handler: async (ctx, args) => { const run = await ctx.db.get(args.analysisRunId); if (!run) throw new Error("Analysis run not found"); const now = Date.now(); for (const finding of args.findings) await ctx.db.insert("findings", { organizationId: run.organizationId, studyId: run.studyId, analysisRunId: run._id, viewType: finding.viewType, findingType: finding.viewType === "contradiction" ? "risk" : "theme", title: finding.title, narrative: finding.narrative, strength: finding.strength, supportingEvidenceIds: finding.supportingEvidenceIds, conflictingEvidenceIds: finding.conflictingEvidenceIds, questionId: finding.questionId, segment: finding.segment, createdAt: now, updatedAt: now }); await ctx.db.patch(run._id, { status: "completed", summary: args.summary, providerOperationId: args.providerOperationId, inputTokens: args.usage.inputTokens, outputTokens: args.usage.outputTokens, totalTokens: args.usage.totalTokens, finalizedCredits: args.finalizedCredits, updatedAt: now, completedAt: now }); } });
export const failAnalysis = internalMutation({ args: { analysisRunId: v.id("analysisRuns"), error: v.string() }, handler: async (ctx, args) => { await ctx.db.patch(args.analysisRunId, { status: "failed", error: args.error, updatedAt: Date.now() }); } });

function analysisSystemPrompt() { return `Analyze only the supplied response evidence. Return JSON {"summary":"...","findings":[...]}. Every finding needs viewType (question, segment, theme, contradiction, or limitation), title, narrative, strength (emerging, supported, strong), supportingEvidenceIds, conflictingEvidenceIds, and optional questionId/segment. Include at least one finding for every viewType. Use only exact evidence IDs supplied. Every finding needs supporting evidence; contradictions also need conflicting evidence. Never invent quotes or participant claims.`; }
