import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";
import { assertOutreachDraft, assertOutreachLaunch } from "./lib/outreach";

const channel = v.union(v.literal("email"), v.literal("voice"));

export const listForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    return await ctx.db
      .query("outreachBatches")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .collect();
  },
});

export const createDraft = mutation({
  args: {
    studyId: v.id("studies"),
    participantBatchId: v.optional(v.id("participantImportBatches")),
    participantIds: v.array(v.id("studyParticipants")),
    channels: v.array(channel),
  },
  handler: async (ctx, args) => {
    const { user, study } = await requireStudyAccess(ctx, args.studyId);
    const questionnaire = study.currentInterviewBriefVersionId
      ? await ctx.db.get(study.currentInterviewBriefVersionId)
      : null;
    if (!questionnaire || questionnaire.studyId !== study._id) {
      throw new Error("An approved questionnaire is required before creating outreach");
    }

    const participantBatch = args.participantBatchId
      ? await ctx.db.get(args.participantBatchId)
      : null;
    if (
      participantBatch &&
      (participantBatch.studyId !== study._id ||
        study.currentApprovedParticipantBatchId !== participantBatch._id)
    ) {
      throw new Error("Select the current approved participant batch");
    }

    const participantIds = [...new Set(args.participantIds)];
    const participants = await Promise.all(participantIds.map((id) => ctx.db.get(id)));
    if (
      participants.some(
        (participant) =>
          !participant ||
          participant.studyId !== study._id ||
          participant.status === "archived" ||
          (participantBatch && participant.importBatchId !== participantBatch._id),
      )
    ) {
      throw new Error("Every participant must belong to the selected study and batch");
    }

    const channels = [...new Set(args.channels)];
    assertOutreachDraft({
      studyStatus: study.status,
      questionnaireStatus: questionnaire.status,
      participantBatchStatus: participantBatch?.status,
      participantCount: participants.length,
      channels,
    });
    for (const participant of participants) {
      const reachable =
        participant &&
        ((channels.includes("email") && Boolean(participant.email)) ||
          (channels.includes("voice") && Boolean(participant.phone)));
      if (!reachable) {
        throw new Error(`Participant ${participant?.name ?? "unknown"} has no contact for the selected channels`);
      }
    }

    const now = Date.now();
    const outreachBatchId = await ctx.db.insert("outreachBatches", {
      organizationId: study.organizationId,
      studyId: study._id,
      questionnaireVersionId: questionnaire._id,
      participantBatchId: participantBatch?._id,
      participantIds,
      channels,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit(ctx, {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      eventType: "outreach.draft_created",
      summary: `Created outreach draft for ${participantIds.length} participants`,
      metadata: { outreachBatchId, participantIds, channels },
    });
    return outreachBatchId;
  },
});

export const submitForApproval = mutation({
  args: { outreachBatchId: v.id("outreachBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.outreachBatchId);
    if (!batch) throw new Error("Outreach batch not found");
    const { user, study } = await requireStudyAccess(ctx, batch.studyId);
    if (batch.status !== "draft") throw new Error("Only a draft can be submitted for approval");
    const now = Date.now();
    await ctx.db.patch(batch._id, { status: "awaiting_approval", updatedAt: now });
    await recordAudit(ctx, {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      eventType: "outreach.submitted",
      summary: "Submitted outreach for approval",
      metadata: { outreachBatchId: batch._id },
    });
  },
});

export const approve = mutation({
  args: { outreachBatchId: v.id("outreachBatches"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.outreachBatchId);
    if (!batch) throw new Error("Outreach batch not found");
    const { user, study } = await requireStudyAccess(ctx, batch.studyId);
    if (batch.status !== "awaiting_approval") {
      throw new Error("Only outreach awaiting approval can be approved");
    }
    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("approvals", {
      organizationId: study.organizationId,
      studyId: study._id,
      subjectType: "outreach_campaign",
      subjectId: batch._id,
      decision: "approved",
      note: args.note?.trim() || undefined,
      decidedBy: user._id,
      decidedAt: now,
    });
    await recordAudit(ctx, {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      eventType: "outreach.approved",
      summary: `Approved outreach to ${batch.participantIds.length} participants`,
      metadata: { outreachBatchId: batch._id },
    });
  },
});

export const launch = mutation({
  args: { outreachBatchId: v.id("outreachBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.outreachBatchId);
    if (!batch) throw new Error("Outreach batch not found");
    const { user, study } = await requireStudyAccess(ctx, batch.studyId);
    assertOutreachLaunch({ studyStatus: study.status, outreachStatus: batch.status });
    const questionnaire = await ctx.db.get(batch.questionnaireVersionId);
    if (
      !questionnaire ||
      questionnaire.status !== "approved" ||
      study.currentInterviewBriefVersionId !== questionnaire._id
    ) {
      throw new Error("The approved questionnaire changed; create a new outreach batch");
    }
    if (batch.participantBatchId) {
      const participantBatch = await ctx.db.get(batch.participantBatchId);
      if (
        !participantBatch ||
        participantBatch.status !== "approved" ||
        study.currentApprovedParticipantBatchId !== participantBatch._id
      ) {
        throw new Error("The approved participant batch changed; create a new outreach batch");
      }
    }
    const participants = await Promise.all(batch.participantIds.map((id) => ctx.db.get(id)));
    if (participants.some((participant) => !participant || participant.status === "archived")) {
      throw new Error("The participant selection changed; create a new outreach batch");
    }
    const now = Date.now();
    await ctx.db.patch(batch._id, { status: "running", launchedAt: now, updatedAt: now });
    await ctx.db.patch(study._id, { status: "fieldwork_running", updatedAt: now });
    await recordAudit(ctx, {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      eventType: "outreach.launched",
      summary: `Launched outreach to ${batch.participantIds.length} participants`,
      metadata: { outreachBatchId: batch._id },
    });
    return batch._id;
  },
});

async function recordAudit(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    studyId: Id<"studies">;
    actorUserId: Id<"users">;
    eventType: string;
    summary: string;
    metadata: Record<string, unknown>;
  },
) {
  await ctx.db.insert("auditEvents", {
    ...args,
    actorType: "user",
    createdAt: Date.now(),
  });
}
