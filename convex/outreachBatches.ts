import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";
import { assertOutreachDraft, assertOutreachLaunch, createApprovedSnapshot, creditReservationForDelivery, deliveryIdempotencyKey, planDeliveryRetry } from "./lib/outreach";

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
    participantBatchId: v.id("participantImportBatches"),
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
    const plan = await ctx.db.get(questionnaire.studyPlanVersionId);
    if (!plan || plan.studyId !== study._id || plan.status !== "approved" || study.currentStudyPlanVersionId !== plan._id) {
      throw new Error("The current approved study plan is required before creating outreach");
    }

    const participantBatch = await ctx.db.get(args.participantBatchId);
    if (
      !participantBatch ||
      participantBatch.studyId !== study._id ||
      study.currentApprovedParticipantBatchId !== participantBatch._id
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
          participant.importBatchId !== participantBatch._id,
      )
    ) {
      throw new Error("Every participant must belong to the selected study and batch");
    }

    const channels = [...new Set(args.channels)];
    assertOutreachDraft({
      studyStatus: study.status,
      questionnaireStatus: questionnaire.status,
      participantBatchStatus: participantBatch.status,
      participantCount: participants.length,
      channels,
      planStatus: plan.status,
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
      studyPlanVersionId: plan._id,
      participantBatchId: participantBatch._id,
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
    const participants = await Promise.all(batch.participantIds.map((id) => ctx.db.get(id)));
    if (participants.some((participant) => !participant)) throw new Error("Participant snapshot changed");
    const snapshot = createApprovedSnapshot({
      studyPlanVersionId: String(batch.studyPlanVersionId),
      questionnaireVersionId: String(batch.questionnaireVersionId),
      participantBatchId: String(batch.participantBatchId),
      requestedChannels: batch.channels,
      participants: participants.map((participant) => ({ id: String(participant!._id), email: participant!.email, phone: participant!.phone })),
    });
    await ctx.db.patch(batch._id, {
      status: "approved",
      approvedSnapshot: snapshot as typeof batch.approvedSnapshot,
      approvedBy: user._id,
      approvedAt: now,
      updatedAt: now,
    });
    for (const recipient of snapshot.recipients) {
      for (const selectedChannel of recipient.channels) {
        const deliveryKey = deliveryIdempotencyKey(String(batch._id), recipient.participantId, selectedChannel);
        const existing = await ctx.db.query("outreachDeliveries").withIndex("by_delivery_key", (q) => q.eq("deliveryKey", deliveryKey)).unique();
        if (!existing) await ctx.db.insert("outreachDeliveries", {
          organizationId: batch.organizationId, studyId: batch.studyId, outreachBatchId: batch._id,
          participantId: recipient.participantId as Id<"studyParticipants">,
          questionnaireVersionId: batch.questionnaireVersionId, channel: selectedChannel,
          deliveryKey, status: "pending", retrySafe: true, attempts: 0, createdAt: now, updatedAt: now,
        });
      }
    }
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

export const launch = action({
  args: { outreachBatchId: v.id("outreachBatches") },
  handler: async (ctx, args) => {
    const prepared = await ctx.runMutation(internal.outreachBatches.prepareLaunch, args);
    for (const delivery of prepared.deliveries) {
      if (!delivery.creditReservationId) {
        const spec = creditReservationForDelivery({ channel: delivery.channel, estimatedMinutes: prepared.estimatedMinutes });
        const reservation = await ctx.runMutation(api.credits.reserveCredits, {
          organizationId: prepared.organizationId, studyId: prepared.studyId,
          operationId: delivery.deliveryKey, operation: spec.operation, maximumCredits: spec.maximumCredits,
          idempotencyKey: `reserve:${delivery.deliveryKey}`, expiresAt: prepared.expiresAt,
        });
        await ctx.runMutation(internal.outreachBatches.attachReservation, { deliveryId: delivery._id, reservationId: reservation.reservationId });
      }
    }
    await ctx.runMutation(internal.outreachBatches.activateLaunch, args);
    const deliveries = await ctx.runQuery(api.outreachBatches.deliveriesForBatch, args);
    for (const delivery of deliveries) {
      if (planDeliveryRetry(delivery) === "dispatch") {
        if (delivery.channel === "email") {
          await ctx.runAction(api.participantInvites.sendEmail, { participantId: delivery.participantId, outreachBatchId: args.outreachBatchId });
        } else {
          const result = await ctx.runAction(api.participantInvites.sendCall, { participantId: delivery.participantId, outreachBatchId: args.outreachBatchId });
          if (result.status === "failed") throw new Error(result.error);
        }
        const accepted = await ctx.runMutation(internal.outreachBatches.markAccepted, { deliveryId: delivery._id });
        if (accepted?.channel === "email" && accepted.creditReservationId) await ctx.runMutation(internal.credits.reconcileUsage, { organizationId: accepted.organizationId, reservationId: accepted.creditReservationId, provider: "resend", providerOperationId: accepted.deliveryKey, nativeQuantity: 1, internalCostMicros: 0, model: "resend-email" });
      }
    }
    return args.outreachBatchId;
  },
});

export const deliveriesForBatch = query({
  args: { outreachBatchId: v.id("outreachBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.outreachBatchId); if (!batch) throw new Error("Outreach batch not found");
    await requireStudyAccess(ctx, batch.studyId);
    return await ctx.db.query("outreachDeliveries").withIndex("by_batch", (q) => q.eq("outreachBatchId", batch._id)).collect();
  },
});

export const prepareLaunch = internalMutation({
  args: { outreachBatchId: v.id("outreachBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.outreachBatchId); if (!batch?.approvedSnapshot) throw new Error("Approved outreach snapshot required");
    const study = await ctx.db.get(batch.studyId); if (!study) throw new Error("Study not found");
    if (batch.status !== "running") assertOutreachLaunch({ studyStatus: study.status, outreachStatus: batch.status });
    const [plan, questionnaire, participantBatch] = await Promise.all([ctx.db.get(batch.approvedSnapshot.studyPlanVersionId), ctx.db.get(batch.approvedSnapshot.questionnaireVersionId), ctx.db.get(batch.approvedSnapshot.participantBatchId)]);
    if (plan?.status !== "approved" || questionnaire?.status !== "approved" || participantBatch?.status !== "approved") throw new Error("Approved launch inputs changed");
    const deliveries = await ctx.db.query("outreachDeliveries").withIndex("by_batch", (q) => q.eq("outreachBatchId", batch._id)).collect();
    return { organizationId: batch.organizationId, studyId: batch.studyId, deliveries, estimatedMinutes: questionnaire.brief.estimatedMinutes, expiresAt: (batch.approvedAt ?? batch.updatedAt) + 24 * 60 * 60 * 1000 };
  },
});

export const attachReservation = internalMutation({ args: { deliveryId: v.id("outreachDeliveries"), reservationId: v.id("creditReservations") }, handler: async (ctx, args) => { const delivery = await ctx.db.get(args.deliveryId); if (delivery && !delivery.creditReservationId) await ctx.db.patch(delivery._id, { creditReservationId: args.reservationId, status: "reserved", updatedAt: Date.now() }); } });
export const activateLaunch = internalMutation({ args: { outreachBatchId: v.id("outreachBatches") }, handler: async (ctx, args) => { const batch = await ctx.db.get(args.outreachBatchId); if (!batch) throw new Error("Outreach batch not found"); const now = Date.now(); await ctx.db.patch(batch._id, { status: "running", launchedAt: batch.launchedAt ?? now, updatedAt: now }); await ctx.db.patch(batch.studyId, { status: "fieldwork_running", updatedAt: now }); } });
export const markAccepted = internalMutation({ args: { deliveryId: v.id("outreachDeliveries") }, handler: async (ctx, args) => { const delivery = await ctx.db.get(args.deliveryId); if (!delivery || delivery.status === "accepted") return delivery; const now = Date.now(); await ctx.db.patch(delivery._id, { status: "accepted", attempts: delivery.attempts + 1, providerAcceptedAt: now, retrySafe: false, updatedAt: now }); return delivery; } });

export const retryDelivery = action({ args: { deliveryId: v.id("outreachDeliveries") }, handler: async (ctx, args): Promise<Id<"outreachBatches">> => { const delivery: Doc<"outreachDeliveries"> = await ctx.runQuery(api.outreachBatches.deliveryForRetry, args); if (planDeliveryRetry(delivery) !== "dispatch") throw new Error("This delivery cannot be retried safely"); return await ctx.runAction(api.outreachBatches.launch, { outreachBatchId: delivery.outreachBatchId }); } });
export const deliveryForRetry = query({ args: { deliveryId: v.id("outreachDeliveries") }, handler: async (ctx, args) => { const delivery = await ctx.db.get(args.deliveryId); if (!delivery) throw new Error("Delivery not found"); await requireStudyAccess(ctx, delivery.studyId); return delivery; } });

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
