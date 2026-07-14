import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";

export const currentForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const { study } = await requireStudyAccess(ctx, args.studyId);
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
    if (study.currentInterviewBriefVersionId) {
      const currentBrief = await ctx.db.get(study.currentInterviewBriefVersionId);
      if (currentBrief && currentBrief.status !== "superseded") {
        await ctx.db.patch(currentBrief._id, { status: "superseded" });
      }
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
      currentInterviewBriefVersionId: undefined,
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

export const approve = mutation({
  args: { planVersionId: v.id("studyPlanVersions") },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planVersionId);
    if (!plan) throw new Error("Study Plan not found");
    const { user, study } = await requireStudyAccess(ctx, plan.studyId);
    if (study.currentStudyPlanVersionId !== plan._id) {
      throw new Error("Only the current Study Plan can be approved");
    }
    if (plan.status !== "draft" && plan.status !== "awaiting_approval") {
      throw new Error("Only a current draft Study Plan can be approved");
    }

    const now = Date.now();
    await ctx.db.patch(plan._id, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: now,
    });
    await ctx.db.patch(study._id, {
      status: "plan_approved",
      updatedAt: now,
    });
    await ctx.db.insert("approvals", {
      organizationId: study.organizationId,
      studyId: study._id,
      subjectType: "study_plan",
      subjectId: plan._id,
      decision: "approved",
      decidedBy: user._id,
      decidedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      actorType: "user",
      eventType: "study_plan.approved",
      summary: `Approved Study Plan version ${plan.version}`,
      metadata: { planVersionId: plan._id, version: plan.version },
      createdAt: now,
    });
    return plan._id;
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
