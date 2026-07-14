import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";

const FIVE_MINUTES = 5 * 60 * 1000;
const TWO_MINUTES = 2 * 60 * 1000;

export const listForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const study = await ctx.db.get(args.studyId);
    if (!user?.defaultOrganizationId || study?.organizationId !== user.defaultOrganizationId) {
      throw new Error("Study not found");
    }
    const records = await ctx.db
      .query("interviewCallRecords")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .collect();
    return await Promise.all(
      records.map(async (record) => ({
        ...record,
        participant: await ctx.db.get(record.participantId),
      })),
    );
  },
});

export const analyticsForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    const study = await ctx.db.get(args.studyId);
    if (!user?.defaultOrganizationId || study?.organizationId !== user.defaultOrganizationId) {
      throw new Error("Study not found");
    }
    const records = await ctx.db
      .query("interviewCallRecords")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .collect();
    const scored = records.filter((record) => record.qualityScores && record.extractedMetrics);
    const average = (key: keyof NonNullable<(typeof scored)[number]["qualityScores"]>) =>
      scored.length
        ? Math.round(scored.reduce((sum, record) => sum + (record.qualityScores?.[key] ?? 0), 0) / scored.length)
        : 0;
    const frequencies = (values: string[]) =>
      [...values.reduce((counts, value) => {
        const normalized = value.trim();
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()).entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 8);
    return {
      totalCalls: records.length,
      analyzedCalls: scored.length,
      averageScores: {
        overall: average("overall"),
        goalCoverage: average("goalCoverage"),
        responseDepth: average("responseDepth"),
        specificity: average("specificity"),
        engagement: average("engagement"),
        interviewerQuality: average("interviewerQuality"),
      },
      averageParticipantWords: scored.length
        ? Math.round(scored.reduce((sum, record) => sum + (record.extractedMetrics?.participantWordCount ?? 0), 0) / scored.length)
        : 0,
      sentiment: frequencies(scored.map((record) => record.extractedMetrics!.sentiment)),
      themes: frequencies(scored.flatMap((record) => record.analysis?.themes ?? [])),
      needs: frequencies(scored.flatMap((record) => record.extractedMetrics?.needs ?? [])),
      painPoints: frequencies(scored.flatMap((record) => record.extractedMetrics?.painPoints ?? [])),
      objections: frequencies(scored.flatMap((record) => record.extractedMetrics?.objections ?? [])),
      opportunities: frequencies(scored.flatMap((record) => record.extractedMetrics?.opportunities ?? [])),
    };
  },
});

export const schedule = internalMutation({
  args: {
    participantId: v.id("studyParticipants"),
    conversationId: v.string(),
    callSid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");
    const existing = await ctx.db
      .query("interviewCallRecords")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .unique();
    if (existing) return existing._id;
    const now = Date.now();
    const callRecordId = await ctx.db.insert("interviewCallRecords", {
      organizationId: participant.organizationId,
      studyId: participant.studyId,
      participantId: participant._id,
      conversationId: args.conversationId,
      callSid: args.callSid,
      status: "scheduled",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(FIVE_MINUTES, internal.callRecords.pullAndAnalyze, {
      callRecordId,
    });
    return callRecordId;
  },
});

export const backfillAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const participants = await ctx.db.query("studyParticipants").collect();
    let created = 0;
    let skipped = 0;
    for (const participant of participants) {
      if (!participant.elevenLabsConversationId) continue;
      const existing = await ctx.db
        .query("interviewCallRecords")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", participant.elevenLabsConversationId!),
        )
        .unique();
      if (existing) {
        skipped += 1;
        continue;
      }
      const now = Date.now();
      const callRecordId = await ctx.db.insert("interviewCallRecords", {
        organizationId: participant.organizationId,
        studyId: participant.studyId,
        participantId: participant._id,
        conversationId: participant.elevenLabsConversationId,
        callSid: participant.telephonyCallSid,
        status: "scheduled",
        attempts: 0,
        createdAt: participant.invitedAt ?? now,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.callRecords.pullAndAnalyze, {
        callRecordId,
      });
      created += 1;
    }
    return { created, skipped };
  },
});

export const reanalyzeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("interviewCallRecords").collect();
    let scheduled = 0;
    for (const record of records) {
      if (!record.transcript?.length || record.status !== "completed") continue;
      await ctx.db.patch(record._id, {
        status: "scheduled",
        attempts: 0,
        error: undefined,
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.callRecords.pullAndAnalyze, {
        callRecordId: record._id,
      });
      scheduled += 1;
    }
    return { scheduled };
  },
});

export const getInternal = internalQuery({
  args: { callRecordId: v.id("interviewCallRecords") },
  handler: async (ctx, args) => await ctx.db.get(args.callRecordId),
});

export const pullAndAnalyze = internalAction({
  args: { callRecordId: v.id("interviewCallRecords") },
  handler: async (ctx, args): Promise<void> => {
    const record = await ctx.runQuery(internal.callRecords.getInternal, args);
    if (!record || record.status === "completed") return;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.callRecords.fail, {
        callRecordId: record._id,
        error: "ELEVENLABS_API_KEY is not configured",
      });
      return;
    }
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(record.conversationId)}`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (!response.ok) throw new Error(`ElevenLabs transcript request failed (${response.status})`);
      const conversation = await response.json();
      if (conversation.status !== "done") {
        await ctx.runMutation(internal.callRecords.retry, { callRecordId: record._id });
        return;
      }
      const transcript = (Array.isArray(conversation.transcript) ? conversation.transcript : [])
        .flatMap((turn: unknown) => {
          if (!turn || typeof turn !== "object") return [];
          const item = turn as Record<string, unknown>;
          if (typeof item.message !== "string" || !item.message.trim()) return [];
          return [{
            role: typeof item.role === "string" ? item.role : "unknown",
            message: item.message.trim(),
            timeInCallSeconds:
              typeof item.time_in_call_secs === "number" ? item.time_in_call_secs : undefined,
          }];
        });
      const analysis = await analyzeTranscript(transcript, conversation.analysis);
      await ctx.runMutation(internal.callRecords.complete, {
        callRecordId: record._id,
        transcript,
        analysis: {
          summary: analysis.summary,
          themes: analysis.themes,
          notableQuotes: analysis.notableQuotes,
          completionAssessment: analysis.completionAssessment,
        },
        qualityScores: analysis.qualityScores,
        extractedMetrics: analysis.extractedMetrics,
        durationSeconds:
          typeof conversation.metadata?.call_duration_secs === "number"
            ? conversation.metadata.call_duration_secs
            : undefined,
        terminationReason:
          typeof conversation.metadata?.termination_reason === "string"
            ? conversation.metadata.termination_reason
            : undefined,
      });
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "Transcript ingestion failed";
      if (record.attempts < 2) {
        await ctx.runMutation(internal.callRecords.retry, { callRecordId: record._id, error });
      } else {
        await ctx.runMutation(internal.callRecords.fail, { callRecordId: record._id, error });
      }
    }
  },
});

export const retry = internalMutation({
  args: { callRecordId: v.id("interviewCallRecords"), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.callRecordId);
    if (!record) return;
    const attempts = record.attempts + 1;
    if (attempts >= 3) {
      await ctx.db.patch(record._id, {
        status: "failed",
        attempts,
        error: args.error ?? "Call did not complete before the retry limit",
        updatedAt: Date.now(),
      });
      return;
    }
    await ctx.db.patch(record._id, {
      status: "scheduled",
      attempts,
      error: args.error,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(TWO_MINUTES, internal.callRecords.pullAndAnalyze, {
      callRecordId: record._id,
    });
  },
});

export const complete = internalMutation({
  args: {
    callRecordId: v.id("interviewCallRecords"),
    transcript: v.array(v.object({
      role: v.string(),
      message: v.string(),
      timeInCallSeconds: v.optional(v.number()),
    })),
    analysis: v.object({
      summary: v.string(),
      themes: v.array(v.string()),
      notableQuotes: v.array(v.string()),
      completionAssessment: v.string(),
    }),
    qualityScores: v.object({
      overall: v.number(),
      goalCoverage: v.number(),
      responseDepth: v.number(),
      specificity: v.number(),
      engagement: v.number(),
      interviewerQuality: v.number(),
    }),
    extractedMetrics: v.object({
      sentiment: v.union(
        v.literal("positive"),
        v.literal("neutral"),
        v.literal("negative"),
        v.literal("mixed"),
      ),
      substantiveAnswerCount: v.number(),
      participantWordCount: v.number(),
      needs: v.array(v.string()),
      painPoints: v.array(v.string()),
      objections: v.array(v.string()),
      opportunities: v.array(v.string()),
    }),
    durationSeconds: v.optional(v.number()),
    terminationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callRecordId, {
      transcript: args.transcript,
      analysis: args.analysis,
      qualityScores: args.qualityScores,
      extractedMetrics: args.extractedMetrics,
      durationSeconds: args.durationSeconds,
      terminationReason: args.terminationReason,
      status: "completed",
      error: undefined,
      updatedAt: Date.now(),
      completedAt: Date.now(),
    });
  },
});

export const fail = internalMutation({
  args: { callRecordId: v.id("interviewCallRecords"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callRecordId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});

async function analyzeTranscript(
  transcript: Array<{ role: string; message: string }>,
  providerAnalysis: unknown,
) {
  const fallback = providerAnalysis && typeof providerAnalysis === "object"
    ? providerAnalysis as Record<string, unknown>
    : {};
  const apiKey =
    process.env.AI_GATEWAY_API_KEY ??
    process.env.VERCEL_AI_GATEWAY_API_KEY ??
    process.env.VERCEL_AI_GATEWAY_KEY;
  if (!apiKey || transcript.length === 0) {
    const participantTurns = transcript.filter((turn) => turn.role === "user");
    return {
      summary: typeof fallback.transcript_summary === "string"
        ? fallback.transcript_summary
        : "No substantive transcript was captured.",
      themes: [],
      notableQuotes: [],
      completionAssessment: transcript.length > 1 ? "Partial interview" : "Insufficient response",
      qualityScores: {
        overall: participantTurns.length ? 35 : 0,
        goalCoverage: 20,
        responseDepth: participantTurns.length ? 30 : 0,
        specificity: participantTurns.length ? 25 : 0,
        engagement: participantTurns.length ? 40 : 0,
        interviewerQuality: transcript.length > 1 ? 40 : 10,
      },
      extractedMetrics: {
        sentiment: "neutral" as const,
        substantiveAnswerCount: participantTurns.length,
        participantWordCount: participantTurns.reduce(
          (count, turn) => count + turn.message.split(/\s+/).filter(Boolean).length,
          0,
        ),
        needs: [],
        painPoints: [],
        objections: [],
        opportunities: [],
      },
    };
  }
  const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.MERIDIAN_MODEL ?? "google/gemini-3.1-flash-lite",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are a second-pass research quality analyst. Analyze this customer interview independently.",
            "Return only JSON with this exact shape:",
            '{"summary":"...","themes":["..."],"notableQuotes":["verbatim participant quote"],"completionAssessment":"...","qualityScores":{"overall":0,"goalCoverage":0,"responseDepth":0,"specificity":0,"engagement":0,"interviewerQuality":0},"extractedMetrics":{"sentiment":"positive|neutral|negative|mixed","substantiveAnswerCount":0,"participantWordCount":0,"needs":["..."],"painPoints":["..."],"objections":["..."],"opportunities":["..."]}}',
            "All scores are integers from 0 to 100. Score overall research usefulness, not respondent desirability.",
            "Normalize evidence labels into short reusable phrases so they aggregate across calls.",
            "Quotes must be verbatim. Stay faithful to the transcript and do not invent evidence.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify(transcript) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Transcript analysis failed (${response.status})`);
  const payload = await response.json();
  const raw = String(payload?.choices?.[0]?.message?.content ?? "")
    .trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const strings = (value: unknown) =>
    (Array.isArray(value) ? value : []).flatMap((item) => typeof item === "string" ? [item] : []);
  const scoreRecord = parsed.qualityScores && typeof parsed.qualityScores === "object"
    ? parsed.qualityScores as Record<string, unknown>
    : {};
  const metricRecord = parsed.extractedMetrics && typeof parsed.extractedMetrics === "object"
    ? parsed.extractedMetrics as Record<string, unknown>
    : {};
  const score = (value: unknown) =>
    Math.round(Math.min(100, Math.max(0, typeof value === "number" ? value : 0)));
  const participantTurns = transcript.filter((turn) => turn.role === "user");
  const sentiment = ["positive", "neutral", "negative", "mixed"].includes(String(metricRecord.sentiment))
    ? metricRecord.sentiment as "positive" | "neutral" | "negative" | "mixed"
    : "neutral";
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "Analysis completed.",
    themes: strings(parsed.themes),
    notableQuotes: strings(parsed.notableQuotes),
    completionAssessment:
      typeof parsed.completionAssessment === "string"
        ? parsed.completionAssessment
        : "Review transcript",
    qualityScores: {
      overall: score(scoreRecord.overall),
      goalCoverage: score(scoreRecord.goalCoverage),
      responseDepth: score(scoreRecord.responseDepth),
      specificity: score(scoreRecord.specificity),
      engagement: score(scoreRecord.engagement),
      interviewerQuality: score(scoreRecord.interviewerQuality),
    },
    extractedMetrics: {
      sentiment,
      substantiveAnswerCount:
        typeof metricRecord.substantiveAnswerCount === "number"
          ? Math.max(0, Math.round(metricRecord.substantiveAnswerCount))
          : participantTurns.length,
      participantWordCount:
        typeof metricRecord.participantWordCount === "number"
          ? Math.max(0, Math.round(metricRecord.participantWordCount))
          : participantTurns.reduce(
              (count, turn) => count + turn.message.split(/\s+/).filter(Boolean).length,
              0,
            ),
      needs: strings(metricRecord.needs),
      painPoints: strings(metricRecord.painPoints),
      objections: strings(metricRecord.objections),
      opportunities: strings(metricRecord.opportunities),
    },
  };
}
