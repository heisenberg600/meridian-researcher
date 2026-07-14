import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { assertDeliveryGate } from "./lib/outreach";

type OutreachContext = {
  participant: Doc<"studyParticipants">;
  study: Doc<"studies">;
  guide: Doc<"interviewBriefVersions">;
  outreachBatch: Doc<"outreachBatches">;
  delivery: Doc<"outreachDeliveries">;
};

const deliveryArgs = {
  deliveryId: v.id("outreachDeliveries"),
};

export const deliveryContext = internalQuery({
  args: deliveryArgs,
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) throw new Error("Delivery not found");
    const participant = await ctx.db.get(delivery.participantId);
    const study = participant ? await ctx.db.get(participant.studyId) : null;
    const outreachBatch = await ctx.db.get(delivery.outreachBatchId);
    const guide = await ctx.db.get(delivery.questionnaireVersionId);
    if (!participant || !study || !outreachBatch || !guide) throw new Error("Approved delivery context changed");
    const recipient = outreachBatch.approvedSnapshot?.recipients.find((item) => item.participantId === participant._id);
    const suppressions = await ctx.db.query("suppressionEntries").withIndex("by_organization", (q) => q.eq("organizationId", delivery.organizationId)).collect();
    const normalizedPhone = participant.phone?.replace(/\D/g, "");
    const suppressed = suppressions.some((entry) =>
      (participant.email && entry.normalizedEmail?.toLowerCase() === participant.email.toLowerCase()) ||
      (normalizedPhone && entry.normalizedPhone?.replace(/\D/g, "") === normalizedPhone));
    assertDeliveryGate({
      outreachStatus: outreachBatch.status,
      snapshotMatches: Boolean(
        outreachBatch.approvedSnapshot && recipient?.channels.includes(delivery.channel) &&
        outreachBatch.approvedSnapshot.questionnaireVersionId === guide._id &&
        outreachBatch.approvedSnapshot.participantBatchId === participant.importBatchId),
      participantStatus: participant.status,
      consentStatus: participant.consentStatus,
      suppressed,
    });
    if (delivery.channel === "email" && !participant.email) throw new Error("Participant has no email address");
    if (delivery.channel === "voice" && !participant.phone) throw new Error("Participant has no phone number");
    return { participant, study, guide, outreachBatch, delivery };
  },
});

export const executeDelivery = internalAction({
  args: deliveryArgs,
  handler: async (ctx, args): Promise<{ providerOperationId: string; inviteToken: string; conversationId?: string; callSid?: string }> => {
    // This is intentionally the last read before the provider request.
    const context = await ctx.runQuery(internal.participantInvites.deliveryContext, args);
    const inviteToken = context.participant.inviteToken ?? crypto.randomUUID();
    const appUrl = (process.env.MERIDIAN_APP_URL ?? "https://hermes-researcher.pages.dev").replace(/\/$/, "");
    const inviteUrl = `${appUrl}/interview/${encodeURIComponent(inviteToken)}`;
    if (context.delivery.channel === "voice") {
      const result = await sendCallAttempt(context, inviteToken, inviteUrl);
      if (result.status === "failed") throw new Error(result.error);
      const providerOperationId = result.conversationId ?? result.callSid;
      if (!providerOperationId) throw new Error("ElevenLabs acceptance was ambiguous");
      return { providerOperationId, inviteToken, conversationId: result.conversationId, callSid: result.callSid };
    }
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured in Convex");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": context.delivery.deliveryKey },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Meridian Research <onboarding@resend.dev>",
        to: [context.participant.email],
        subject: `Invitation: ${context.study.title}`,
        html: inviteEmailHtml({
          participantName: context.participant.name,
          studyTitle: context.study.title,
          estimatedMinutes: context.guide.brief.estimatedMinutes,
          inviteUrl,
        }),
      }),
    });
    if (!response.ok) throw new Error(`Resend rejected the invitation (${response.status}): ${await response.text()}`);
    const payload = await response.json();
    const emailId = String(payload.id ?? "");
    if (!emailId) throw new Error("Resend did not return an email id");
    return { providerOperationId: emailId, inviteToken };
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("studyParticipants")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", args.token))
      .unique();
    if (!participant || participant.status === "archived") return null;
    const study = await ctx.db.get(participant.studyId);
    const guide = study?.currentInterviewBriefVersionId
      ? await ctx.db.get(study.currentInterviewBriefVersionId)
      : null;
    if (!study || !guide || guide.status !== "approved") return null;
    return {
      id: args.token,
      studyTitle: study.title,
      researchGoal: guide.brief.researchObjective,
      learningObjectives: guide.brief.topics.map((topic) => topic.objective),
      respondentLabel: guide.brief.respondentProfile,
      estimatedMinutes: guide.brief.estimatedMinutes,
      sponsor: "Meridian",
      preferredMode: participant.preferredMode,
      consentStatus: participant.consentStatus,
    };
  },
});

export const markSent = internalMutation({
  args: {
    participantId: v.id("studyParticipants"),
    inviteToken: v.string(),
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");
    const now = Date.now();
    await ctx.db.patch(participant._id, {
      inviteToken: args.inviteToken,
      invitedAt: now,
      lastInviteEmailId: args.emailId,
      status: "invited",
      consentStatus: "pending",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: participant.organizationId,
      studyId: participant.studyId,
      actorType: "system",
      eventType: "participant.invited",
      summary: `Sent interview invitation to ${participant.name}`,
      metadata: { participantId: participant._id, emailId: args.emailId },
      createdAt: now,
    });
  },
});

export const recordOutreach = internalMutation({
  args: {
    participantId: v.id("studyParticipants"),
    inviteToken: v.string(),
    email: v.union(
      v.object({ status: v.literal("sent"), providerId: v.string() }),
      v.object({ status: v.literal("failed"), error: v.string() }),
    ),
    call: v.union(
      v.object({
        status: v.literal("initiated"),
        conversationId: v.optional(v.string()),
        callSid: v.optional(v.string()),
      }),
      v.object({ status: v.literal("failed"), error: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");
    const now = Date.now();
    await ctx.db.patch(participant._id, {
      inviteToken: args.inviteToken,
      invitedAt: now,
      lastInviteEmailId: args.email.status === "sent" ? args.email.providerId : participant.lastInviteEmailId,
      emailOutreachStatus: args.email.status,
      emailOutreachError: args.email.status === "failed" ? args.email.error : undefined,
      callOutreachStatus: args.call.status,
      callOutreachError: args.call.status === "failed" ? args.call.error : undefined,
      elevenLabsConversationId:
        args.call.status === "initiated" ? args.call.conversationId : participant.elevenLabsConversationId,
      telephonyCallSid: args.call.status === "initiated" ? args.call.callSid : participant.telephonyCallSid,
      status: "invited",
      consentStatus: "pending",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: participant.organizationId,
      studyId: participant.studyId,
      actorType: "system",
      eventType: "participant.outreach_sent",
      summary: `Sent outreach to ${participant.name}: email ${args.email.status}, call ${args.call.status}`,
      metadata: { participantId: participant._id, email: args.email, call: args.call },
      createdAt: now,
    });
    if (args.call.status === "initiated" && args.call.conversationId) {
      await ctx.scheduler.runAfter(0, internal.callRecords.schedule, {
        participantId: participant._id,
        conversationId: args.call.conversationId,
        callSid: args.call.callSid,
      });
    }
  },
});

export const recordCallOutreach = internalMutation({
  args: {
    participantId: v.id("studyParticipants"),
    inviteToken: v.string(),
    call: v.union(
      v.object({
        status: v.literal("initiated"),
        conversationId: v.optional(v.string()),
        callSid: v.optional(v.string()),
      }),
      v.object({ status: v.literal("failed"), error: v.string() }),
    ),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");
    const now = Date.now();
    await ctx.db.patch(participant._id, {
      inviteToken: args.inviteToken,
      invitedAt: now,
      callOutreachStatus: args.call.status,
      callOutreachError: args.call.status === "failed" ? args.call.error : undefined,
      elevenLabsConversationId:
        args.call.status === "initiated" ? args.call.conversationId : participant.elevenLabsConversationId,
      telephonyCallSid: args.call.status === "initiated" ? args.call.callSid : participant.telephonyCallSid,
      status: "invited",
      consentStatus: "pending",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: participant.organizationId,
      studyId: participant.studyId,
      actorType: "system",
      eventType: "participant.call_initiated",
      summary: `Call outreach to ${participant.name}: ${args.call.status}`,
      metadata: { participantId: participant._id, call: args.call },
      createdAt: now,
    });
    if (args.call.status === "initiated" && args.call.conversationId) {
      await ctx.scheduler.runAfter(0, internal.callRecords.schedule, {
        participantId: participant._id,
        conversationId: args.call.conversationId,
        callSid: args.call.callSid,
      });
    }
  },
});

async function sendCallAttempt(
  context: OutreachContext,
  inviteToken: string,
  inviteUrl: string,
): Promise<
  | { status: "initiated"; conversationId?: string; callSid?: string }
  | { status: "failed"; error: string }
> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
    if (!apiKey || !agentId || !phoneNumberId) {
      throw new Error("ElevenLabs outbound calling is not fully configured");
    }
    const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: normalizePhoneNumber(context.participant.phone!),
        conversation_initiation_client_data: {
          dynamic_variables: {
            invite_id: inviteToken,
            participant_name: context.participant.name,
            study_title: context.study.title,
            research_goal: context.guide.brief.researchObjective,
            learning_objectives: context.guide.brief.topics.map((topic) => topic.objective).join("; "),
            respondent_label: context.guide.brief.respondentProfile,
            estimated_minutes: context.guide.brief.estimatedMinutes,
            invite_url: inviteUrl,
            interview_guide_json: JSON.stringify(context.guide.brief),
            answer_count: 0,
            answers_json: "[]",
          },
        },
        call_recording_enabled: true,
      }),
    });
    if (!response.ok) throw new Error(`ElevenLabs rejected the call (${response.status}): ${await response.text()}`);
    const payload = await response.json();
    if (!payload.success) throw new Error(String(payload.message ?? "ElevenLabs did not initiate the call"));
    return {
      status: "initiated",
      conversationId: typeof payload.conversation_id === "string" ? payload.conversation_id : undefined,
      callSid: typeof payload.callSid === "string" ? payload.callSid : undefined,
    };
  } catch (cause) {
    return { status: "failed", error: cause instanceof Error ? cause.message : "Call failed" };
  }
}

function inviteEmailHtml(args: {
  participantName: string;
  studyTitle: string;
  estimatedMinutes: number;
  inviteUrl: string;
}) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#24231f;line-height:1.6">
    <p style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#a84a2f">Meridian Research</p>
    <h1 style="font-size:24px;line-height:1.25">We would value your perspective</h1>
    <p>Hi ${escape(args.participantName)},</p>
    <p>You have been invited to take part in <strong>${escape(args.studyTitle)}</strong>. The interview takes about ${args.estimatedMinutes} minutes and can be completed at your convenience.</p>
    <p style="margin:28px 0"><a href="${escape(args.inviteUrl)}" style="background:#c2593b;color:white;text-decoration:none;padding:12px 18px;border-radius:4px;display:inline-block">Start interview</a></p>
    <p style="font-size:13px;color:#6b675f">Your responses will be used only for this research study.</p>
  </div>`;
}

function normalizePhoneNumber(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (/^\+[1-9]\d{7,14}$/.test(international)) return international;

  const digits = international.replace(/\D/g, "").replace(/^0+/, "");
  const countryCode = (process.env.DEFAULT_PHONE_COUNTRY_CODE ?? "+91").replace(/\D/g, "");
  const normalized = `+${countryCode}${digits}`;
  if (/^\+[1-9]\d{7,14}$/.test(normalized)) return normalized;
  throw new Error("Enter a valid phone number with country code");
}
