import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";

async function requireStudyAccess(
  ctx: Pick<QueryCtx, "auth" | "db">,
  studyId: Id<"studies">,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  const study = await ctx.db.get(studyId);

  if (!user?.defaultOrganizationId || study?.organizationId !== user.defaultOrganizationId) {
    throw new Error("Study not found");
  }
  return study;
}

export const currentForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const study = await requireStudyAccess(ctx, args.studyId);
    if (!study.currentStudyPlanVersionId) return null;
    return await ctx.db.get(study.currentStudyPlanVersionId);
  },
});

export const listVersions = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    return await ctx.db
      .query("studyPlanVersions")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .collect();
  },
});

export const saveFromAgent = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    markdown: v.string(),
    readiness: v.union(v.literal("draft"), v.literal("ready_for_review")),
    changeSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run) throw new Error("Agent run not found");
    const study = await ctx.db.get(run.studyId);
    if (!study || study.organizationId !== run.organizationId) {
      throw new Error("Study not found");
    }

    const latest = await ctx.db
      .query("studyPlanVersions")
      .withIndex("by_study", (q) => q.eq("studyId", study._id))
      .order("desc")
      .first();
    if (study.currentStudyPlanVersionId) {
      await supersedeCurrentPlan(ctx, study.currentStudyPlanVersionId);
    }

    const now = Date.now();
    const status = args.readiness === "ready_for_review" ? "awaiting_approval" : "draft";
    const planVersionId = await ctx.db.insert("studyPlanVersions", {
      organizationId: run.organizationId,
      studyId: study._id,
      version: (latest?.version ?? 0) + 1,
      markdown: args.markdown.trim(),
      status,
      createdByAgentRunId: run._id,
      createdAt: now,
    });

    await ctx.db.patch(study._id, {
      currentStudyPlanVersionId: planVersionId,
      status: args.readiness === "ready_for_review" ? "awaiting_plan_approval" : "draft",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: run.organizationId,
      studyId: study._id,
      actorType: "agent",
      eventType: "study_plan.updated",
      summary: args.changeSummary,
      metadata: { planVersionId, version: (latest?.version ?? 0) + 1, status },
      createdAt: now,
    });

    return {
      planVersionId,
      version: (latest?.version ?? 0) + 1,
      status,
      changeSummary: args.changeSummary,
    };
  },
});

async function supersedeCurrentPlan(
  ctx: MutationCtx,
  planVersionId: Id<"studyPlanVersions">,
) {
  const current = await ctx.db.get(planVersionId);
  if (current && current.status !== "superseded") {
    await ctx.db.patch(planVersionId, { status: "superseded" });
  }
}
