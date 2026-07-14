import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { assertOutreachDelivery } from "./lib/outreach";

type OutreachContext = {
  participant: Doc<"studyParticipants">;
  study: Doc<"studies">;
  guide: Doc<"interviewBriefVersions">;
  outreachBatch: Doc<"outreachBatches">;
};

const deliveryArgs = {
  participantId: v.id("studyParticipants"),
  outreachBatchId: v.id("outreachBatches"),
};

export const emailContext = query({
  args: deliveryArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const participant = await ctx.db.get(args.participantId);
    const study = participant ? await ctx.db.get(participant.studyId) : null;
    if (!user?.defaultOrganizationId || !participant || !study || study.organizationId !== user.defaultOrganizationId) {
      throw new Error("Participant not found");
    }
    if (!participant.email) throw new Error("This participant does not have an email address");
    if (!study.currentInterviewBriefVersionId) throw new Error("Generate and approve an interview guide first");
    const guide = await ctx.db.get(study.currentInterviewBriefVersionId);
    if (!guide || guide.status !== "approved") throw new Error("Approve the interview guide before inviting participants");
    const outreachBatch = await ctx.db.get(args.outreachBatchId);
    if (!outreachBatch || outreachBatch.studyId !== study._id) throw new Error("Outreach batch not found");
    assertOutreachDelivery({
      outreachStatus: outreachBatch.status,
      participantIncluded: outreachBatch.participantIds.includes(participant._id),
      questionnaireMatches: outreachBatch.questionnaireVersionId === guide._id,
      participantBatchMatches: outreachBatch.participantBatchId === participant.importBatchId,
      channel: "email",
      channels: outreachBatch.channels,
    });
    return { participant, study, guide, outreachBatch };
  },
});

export const callContext = query({
  args: deliveryArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const participant = await ctx.db.get(args.participantId);
    const study = participant ? await ctx.db.get(participant.studyId) : null;
    if (!user?.defaultOrganizationId || !participant || !study || study.organizationId !== user.defaultOrganizationId) {
      throw new Error("Participant not found");
    }
    if (!participant.phone) throw new Error("This participant does not have a phone number");
    if (!study.currentInterviewBriefVersionId) throw new Error("Generate and approve an interview guide first");
    const guide = await ctx.db.get(study.currentInterviewBriefVersionId);
    if (!guide || guide.status !== "approved") throw new Error("Approve the interview guide before calling participants");
    const outreachBatch = await ctx.db.get(args.outreachBatchId);
    if (!outreachBatch || outreachBatch.studyId !== study._id) throw new Error("Outreach batch not found");
    assertOutreachDelivery({
      outreachStatus: outreachBatch.status,
      participantIncluded: outreachBatch.participantIds.includes(participant._id),
      questionnaireMatches: outreachBatch.questionnaireVersionId === guide._id,
      participantBatchMatches: outreachBatch.participantBatchId === participant.importBatchId,
      channel: "voice",
      channels: outreachBatch.channels,
    });
    return { participant, study, guide, outreachBatch };
  },
});

export const sendEmail = action({
  args: deliveryArgs,
  handler: async (ctx, args): Promise<{ emailId: string; inviteUrl: string }> => {
    const context = await ctx.runQuery(api.participantInvites.emailContext, args);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured in Convex");
    const inviteToken = context.participant.inviteToken ?? crypto.randomUUID();
    const appUrl = (process.env.MERIDIAN_APP_URL ?? "https://hermes-researcher.pages.dev").replace(/\/$/, "");
    const inviteUrl = `${appUrl}/interview/${encodeURIComponent(inviteToken)}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    await ctx.runMutation(internal.participantInvites.markSent, {
      participantId: context.participant._id,
      inviteToken,
      emailId,
    });
    return { emailId, inviteUrl };
  },
});

export const sendOutreach = action({
  args: deliveryArgs,
  handler: async (ctx, args): Promise<{
    email: { status: "sent"; providerId: string } | { status: "failed"; error: string };
    call: { status: "initiated"; conversationId?: string; callSid?: string } | { status: "failed"; error: string };
  }> => {
    const context = await ctx.runQuery(api.participantInvites.emailContext, args);
    assertOutreachDelivery({
      outreachStatus: context.outreachBatch.status,
      participantIncluded: true,
      questionnaireMatches: true,
      participantBatchMatches: true,
      channel: "voice",
      channels: context.outreachBatch.channels,
    });
    if (!context.participant.phone) throw new Error("Add a phone number before sending phone outreach");
    normalizePhoneNumber(context.participant.phone);

    const inviteToken = context.participant.inviteToken ?? crypto.randomUUID();
    const appUrl = (process.env.MERIDIAN_APP_URL ?? "https://hermes-researcher.pages.dev").replace(/\/$/, "");
    const inviteUrl = `${appUrl}/interview/${encodeURIComponent(inviteToken)}`;
    const [email, call] = await Promise.all([
      sendEmailAttempt(context, inviteUrl),
      sendCallAttempt(context, inviteToken, inviteUrl),
    ]);
    await ctx.runMutation(internal.participantInvites.recordOutreach, {
      participantId: context.participant._id,
      inviteToken,
      email,
      call,
    });
    return { email, call };
  },
});

export const sendCall = action({
  args: deliveryArgs,
  handler: async (ctx, args): Promise<
    | { status: "initiated"; conversationId?: string; callSid?: string }
    | { status: "failed"; error: string }
  > => {
    const context = await ctx.runQuery(api.participantInvites.callContext, args);
    normalizePhoneNumber(context.participant.phone!);
    const inviteToken = context.participant.inviteToken ?? crypto.randomUUID();
    const appUrl = (process.env.MERIDIAN_APP_URL ?? "https://hermes-researcher.pages.dev").replace(/\/$/, "");
    const inviteUrl = `${appUrl}/interview/${encodeURIComponent(inviteToken)}`;
    const result = await sendCallAttempt(context, inviteToken, inviteUrl);
    await ctx.runMutation(internal.participantInvites.recordCallOutreach, {
      participantId: context.participant._id,
      inviteToken,
      call: result,
    });
    return result;
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

async function sendEmailAttempt(
  context: OutreachContext,
  inviteUrl: string,
): Promise<{ status: "sent"; providerId: string } | { status: "failed"; error: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured in Convex");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    const providerId = String(payload.id ?? "");
    if (!providerId) throw new Error("Resend did not return an email id");
    return { status: "sent", providerId };
  } catch (cause) {
    return { status: "failed", error: cause instanceof Error ? cause.message : "Email failed" };
  }
}

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
