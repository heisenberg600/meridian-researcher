import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";

export type NormalizedEvidence = {
  sourceKey: string;
  organizationId: string;
  studyId: string;
  participantId: string;
  questionnaireVersionId: string;
  channel: "form" | "voice";
  interviewSessionId?: string;
  callRecordId?: string;
  questionId?: string;
  questionLabel?: string;
  excerpt: string;
  responseValue?: string | string[];
  answerLocator?: string;
  timestampSeconds?: number;
  endTimestampSeconds?: number;
  segment?: string;
};

export function normalizeTypedAnswers(args: {
  interviewSessionId: string;
  organizationId: string;
  studyId: string;
  participantId: string;
  questionnaireVersionId: string;
  segment?: string;
  answers: Array<{ stepId: string; label: string; value: string | string[] }>;
}): NormalizedEvidence[] {
  return args.answers.flatMap((answer) => {
    const values = Array.isArray(answer.value)
      ? answer.value.map((value) => value.trim()).filter(Boolean)
      : answer.value.trim();
    const excerpt = Array.isArray(values) ? values.join(" · ") : values;
    if (!excerpt) return [];
    return [{
      sourceKey: `form:${args.interviewSessionId}:${answer.stepId}`,
      organizationId: args.organizationId,
      studyId: args.studyId,
      participantId: args.participantId,
      questionnaireVersionId: args.questionnaireVersionId,
      channel: "form" as const,
      interviewSessionId: args.interviewSessionId,
      questionId: answer.stepId,
      questionLabel: answer.label,
      excerpt,
      responseValue: values,
      answerLocator: `Answer to “${answer.label}”`,
      segment: args.segment,
    }];
  });
}

export function normalizeTranscriptSpans(args: {
  callRecordId: string;
  organizationId: string;
  studyId: string;
  participantId: string;
  questionnaireVersionId: string;
  segment?: string;
  durationSeconds?: number;
  transcript: Array<{ role: string; message: string; timeInCallSeconds?: number }>;
}): NormalizedEvidence[] {
  let precedingQuestion: string | undefined;
  const evidence: NormalizedEvidence[] = [];
  args.transcript.forEach((turn, index) => {
    const message = turn.message.trim();
    if (!message) return;
    if (!isParticipantRole(turn.role)) {
      precedingQuestion = message;
      return;
    }
    const start = safeTimestamp(turn.timeInCallSeconds);
    const nextTimestamp = safeTimestamp(args.transcript[index + 1]?.timeInCallSeconds);
    const duration = safeTimestamp(args.durationSeconds);
    const end = nextTimestamp !== undefined && (start === undefined || nextTimestamp >= start)
      ? nextTimestamp
      : duration !== undefined && (start === undefined || duration >= start)
        ? duration
        : undefined;
    evidence.push({
      sourceKey: `voice:${args.callRecordId}:${index}`,
      organizationId: args.organizationId,
      studyId: args.studyId,
      participantId: args.participantId,
      questionnaireVersionId: args.questionnaireVersionId,
      channel: "voice",
      callRecordId: args.callRecordId,
      questionId: precedingQuestion ? `transcript-question:${index}` : undefined,
      questionLabel: precedingQuestion,
      excerpt: message,
      responseValue: message,
      answerLocator: start === undefined
        ? "Transcript response"
        : end === undefined
          ? formatTimestamp(start)
          : `${formatTimestamp(start)}–${formatTimestamp(end)}`,
      timestampSeconds: start,
      endTimestampSeconds: end,
      segment: args.segment,
    });
  });
  return evidence;
}

function isParticipantRole(role: string) {
  return ["user", "participant", "customer", "respondent"].includes(role.trim().toLowerCase());
}

function safeTimestamp(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function formatTimestamp(seconds: number) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

export const normalizeInterviewSession = internalMutation({
  args: { interviewSessionId: v.id("interviewSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.interviewSessionId);
    if (
      !session?.organizationId ||
      !session.studyId ||
      !session.participantId ||
      !session.questionnaireVersionId
    ) return [];
    const participant = await ctx.db.get(session.participantId);
    const candidates = normalizeTypedAnswers({
      interviewSessionId: session._id,
      organizationId: session.organizationId,
      studyId: session.studyId,
      participantId: session.participantId,
      questionnaireVersionId: session.questionnaireVersionId,
      segment: participant?.segment,
      answers: session.answers,
    });
    return await upsertEvidence(ctx, candidates);
  },
});

export const normalizeCallRecord = internalMutation({
  args: { callRecordId: v.id("interviewCallRecords") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.callRecordId);
    if (!record?.transcript?.length) return [];
    const participant = await ctx.db.get(record.participantId);
    const study = await ctx.db.get(record.studyId);
    const questionnaireVersionId = record.questionnaireVersionId ?? study?.currentInterviewBriefVersionId;
    if (!questionnaireVersionId) return [];
    const candidates = normalizeTranscriptSpans({
      callRecordId: record._id,
      organizationId: record.organizationId,
      studyId: record.studyId,
      participantId: record.participantId,
      questionnaireVersionId,
      segment: participant?.segment,
      durationSeconds: record.durationSeconds,
      transcript: record.transcript,
    });
    return await upsertEvidence(ctx, candidates);
  },
});

export const normalizeStudy = internalMutation({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("interviewSessions")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .collect();
    const calls = await ctx.db
      .query("interviewCallRecords")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .collect();
    const evidenceIds: Id<"responseEvidence">[] = [];
    for (const session of sessions) {
      if (!session.organizationId || !session.participantId || !session.questionnaireVersionId) continue;
      const participant = await ctx.db.get(session.participantId);
      evidenceIds.push(...await upsertEvidence(ctx, normalizeTypedAnswers({
        interviewSessionId: session._id,
        organizationId: session.organizationId,
        studyId: args.studyId,
        participantId: session.participantId,
        questionnaireVersionId: session.questionnaireVersionId,
        segment: participant?.segment,
        answers: session.answers,
      })));
    }
    const study = await ctx.db.get(args.studyId);
    for (const call of calls) {
      if (!call.transcript?.length) continue;
      const questionnaireVersionId = call.questionnaireVersionId ?? study?.currentInterviewBriefVersionId;
      if (!questionnaireVersionId) continue;
      const participant = await ctx.db.get(call.participantId);
      evidenceIds.push(...await upsertEvidence(ctx, normalizeTranscriptSpans({
        callRecordId: call._id,
        organizationId: call.organizationId,
        studyId: args.studyId,
        participantId: call.participantId,
        questionnaireVersionId,
        segment: participant?.segment,
        durationSeconds: call.durationSeconds,
        transcript: call.transcript,
      })));
    }
    return uniqueIds(evidenceIds);
  },
});

export const getEvidenceDetail = query({
  args: { evidenceId: v.id("responseEvidence") },
  handler: async (ctx, args) => {
    const evidence = await ctx.db.get(args.evidenceId);
    if (!evidence) return null;
    await requireStudyAccess(ctx, evidence.studyId);
    const participant = await ctx.db.get(evidence.participantId);
    return {
      ...evidence,
      participant: participant ? {
        id: participant._id,
        name: participant.name,
        segment: participant.segment,
      } : null,
      target: evidence.channel === "voice"
        ? {
            kind: "transcript_span" as const,
            callRecordId: evidence.callRecordId,
            timestampSeconds: evidence.timestampSeconds,
            endTimestampSeconds: evidence.endTimestampSeconds,
          }
        : {
            kind: "typed_answer" as const,
            interviewSessionId: evidence.interviewSessionId,
            questionId: evidence.questionId,
          },
    };
  },
});

async function upsertEvidence(ctx: Pick<MutationCtx, "db">, candidates: NormalizedEvidence[]) {
  const ids: Id<"responseEvidence">[] = [];
  for (const candidate of candidates) {
    const existing = await ctx.db
      .query("responseEvidence")
      .withIndex("by_source_key", (q) => q.eq("sourceKey", candidate.sourceKey))
      .unique();
    const value = {
      organizationId: candidate.organizationId as Id<"organizations">,
      studyId: candidate.studyId as Id<"studies">,
      participantId: candidate.participantId as Id<"studyParticipants">,
      questionnaireVersionId: candidate.questionnaireVersionId as Id<"interviewBriefVersions">,
      sourceKey: candidate.sourceKey,
      channel: candidate.channel,
      interviewSessionId: candidate.interviewSessionId as Id<"interviewSessions"> | undefined,
      callRecordId: candidate.callRecordId as Id<"interviewCallRecords"> | undefined,
      questionId: candidate.questionId,
      questionLabel: candidate.questionLabel,
      excerpt: candidate.excerpt,
      responseValue: candidate.responseValue,
      answerLocator: candidate.answerLocator,
      timestampSeconds: candidate.timestampSeconds,
      endTimestampSeconds: candidate.endTimestampSeconds,
      segment: candidate.segment,
    };
    if (existing) {
      if (existing.studyId !== value.studyId || existing.participantId !== value.participantId) {
        throw new Error("Evidence source key is already assigned to another response");
      }
      await ctx.db.patch(existing._id, value);
      ids.push(existing._id);
    } else {
      ids.push(await ctx.db.insert("responseEvidence", { ...value, createdAt: Date.now() }));
    }
  }
  return ids;
}

function uniqueIds<T extends string>(values: T[]) {
  return [...new Set(values)];
}
