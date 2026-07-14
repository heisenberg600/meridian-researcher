import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";
import { assertStudyCan } from "./lib/workflow";

const briefValidator = v.object({
  title: v.string(),
  researchObjective: v.string(),
  respondentProfile: v.string(),
  estimatedMinutes: v.number(),
  openingScript: v.string(),
  topics: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      objective: v.string(),
      questions: v.array(v.string()),
      probes: v.array(v.string()),
    }),
  ),
  closingScript: v.string(),
  guardrails: v.array(v.string()),
});

type Brief = {
  title: string;
  researchObjective: string;
  respondentProfile: string;
  estimatedMinutes: number;
  openingScript: string;
  topics: Array<{
    id: string;
    title: string;
    objective: string;
    questions: string[];
    probes: string[];
  }>;
  closingScript: string;
  guardrails: string[];
};

export const currentForStudy = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const { study } = await requireStudyAccess(ctx, args.studyId);
    if (!study.currentInterviewBriefVersionId) return null;
    return await ctx.db.get(study.currentInterviewBriefVersionId);
  },
});

export const listVersions = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    return await ctx.db
      .query("interviewBriefVersions")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .collect();
  },
});

export const generationContext = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const { study } = await requireStudyAccess(ctx, args.studyId);
    if (!study.currentStudyPlanVersionId) throw new Error("Create a Study Plan first");
    const plan = await ctx.db.get(study.currentStudyPlanVersionId);
    if (!plan) throw new Error("Current Study Plan was not found");
    if (plan.status !== "approved") {
      throw new Error("Approve the current Study Plan before generating a questionnaire");
    }
    assertStudyCan(study.status, "generate_questionnaire");
    return {
      studyId: study._id,
      organizationId: study.organizationId,
      studyTitle: study.title,
      businessDecision: study.businessDecision,
      studyPlanVersionId: plan._id,
      studyPlanMarkdown: plan.markdown,
    };
  },
});

export const generateFromPlan = action({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args): Promise<{ briefId: Id<"interviewBriefVersions">; version: number }> => {
    const context = await ctx.runQuery(api.interviewBriefs.generationContext, args);
    const apiKey =
      process.env.AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_KEY;
    if (!apiKey) throw new Error("AI Gateway is not configured");

    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.MERIDIAN_MODEL ?? "google/gemini-3.1-flash-lite",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are Meridian, a senior qualitative researcher. Convert an approved research plan into a neutral, adaptive interview guide. Return only JSON matching the requested shape. Questions must be concise, open, non-leading, and suitable for either a form or voice interview.",
          },
          {
            role: "user",
            content: buildGenerationPrompt(context),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Interview guide generation failed (${response.status}): ${await response.text()}`);
    }
    const payload = await response.json();
    const raw = String(payload?.choices?.[0]?.message?.content ?? "");
    const brief = normalizeBrief(JSON.parse(stripCodeFence(raw)), context.studyTitle);
    return await ctx.runMutation(internal.interviewBriefs.saveGenerated, {
      organizationId: context.organizationId,
      studyId: context.studyId,
      studyPlanVersionId: context.studyPlanVersionId,
      brief,
    });
  },
});

export const saveGenerated = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    studyPlanVersionId: v.id("studyPlanVersions"),
    brief: briefValidator,
  },
  handler: async (ctx, args) => {
    const study = await ctx.db.get(args.studyId);
    if (!study || study.organizationId !== args.organizationId) throw new Error("Study not found");
    const plan = await ctx.db.get(args.studyPlanVersionId);
    if (
      !plan ||
      plan.status !== "approved" ||
      study.currentStudyPlanVersionId !== plan._id ||
      study.status !== "plan_approved"
    ) {
      throw new Error("The current Study Plan must remain approved while generating the interview guide");
    }
    const latest = await ctx.db
      .query("interviewBriefVersions")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .first();
    if (study.currentInterviewBriefVersionId) {
      const current = await ctx.db.get(study.currentInterviewBriefVersionId);
      if (current && current.status !== "superseded") {
        await ctx.db.patch(current._id, { status: "superseded" });
      }
    }
    const now = Date.now();
    const version = (latest?.version ?? 0) + 1;
    const briefId = await ctx.db.insert("interviewBriefVersions", {
      ...args,
      version,
      status: "awaiting_approval",
      createdAt: now,
    });
    await ctx.db.patch(study._id, { currentInterviewBriefVersionId: briefId, updatedAt: now });
    await ctx.db.insert("auditEvents", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      actorType: "agent",
      eventType: "interview_brief.generated",
      summary: `Generated interview guide version ${version}`,
      metadata: { briefId, version, studyPlanVersionId: args.studyPlanVersionId },
      createdAt: now,
    });
    return { briefId, version };
  },
});

export const approve = mutation({
  args: { briefId: v.id("interviewBriefVersions") },
  handler: async (ctx, args) => {
    const brief = await ctx.db.get(args.briefId);
    if (!brief) throw new Error("Interview guide not found");
    const { user, study } = await requireStudyAccess(ctx, brief.studyId);
    if (study.currentInterviewBriefVersionId !== brief._id) {
      throw new Error("Only the current interview guide can be approved");
    }
    if (brief.status !== "awaiting_approval") {
      throw new Error("Only an interview guide awaiting approval can be approved");
    }
    const plan = study.currentStudyPlanVersionId
      ? await ctx.db.get(study.currentStudyPlanVersionId)
      : null;
    if (
      !plan ||
      plan.status !== "approved" ||
      brief.studyPlanVersionId !== plan._id ||
      study.status !== "plan_approved"
    ) {
      throw new Error("Approve the current Study Plan before approving the interview guide");
    }
    const now = Date.now();
    await ctx.db.patch(brief._id, { status: "approved", approvedBy: user._id, approvedAt: now });
    await ctx.db.patch(study._id, { status: "questionnaire_approved", updatedAt: now });
    await ctx.db.insert("approvals", {
      organizationId: study.organizationId,
      studyId: study._id,
      subjectType: "interview_brief",
      subjectId: brief._id,
      decision: "approved",
      decidedBy: user._id,
      decidedAt: now,
    });
    await recordAudit(ctx, study.organizationId, study._id, user._id, brief.version, now);
  },
});

function buildGenerationPrompt(context: {
  studyTitle: string;
  businessDecision: string;
  studyPlanMarkdown: string;
}) {
  return [
    `Study: ${context.studyTitle}`,
    `Business decision: ${context.businessDecision}`,
    "Study Plan:",
    context.studyPlanMarkdown,
    "",
    "Return this JSON shape:",
    '{"title":"...","researchObjective":"...","respondentProfile":"...","estimatedMinutes":15,"openingScript":"...","topics":[{"id":"snake_case","title":"...","objective":"...","questions":["..."],"probes":["..."]}],"closingScript":"...","guardrails":["..."]}',
    "Include 3-6 topics, 1-3 primary questions per topic, and useful optional probes. Do not invent facts not present in the plan.",
  ].join("\n");
}

function stripCodeFence(value: string) {
  return value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

function normalizeBrief(value: unknown, studyTitle: string): Brief {
  if (!value || typeof value !== "object") throw new Error("The model returned an invalid guide");
  const record = value as Record<string, unknown>;
  const text = (input: unknown, fallback: string) =>
    typeof input === "string" && input.trim() ? input.trim() : fallback;
  const strings = (input: unknown) =>
    (Array.isArray(input) ? input : []).flatMap((item) =>
      typeof item === "string" && item.trim() ? [item.trim()] : [],
    );
  const topics = (Array.isArray(record.topics) ? record.topics : []).flatMap((topic, index) => {
    if (!topic || typeof topic !== "object") return [];
    const item = topic as Record<string, unknown>;
    return [{
      id: text(item.id, `topic_${index + 1}`),
      title: text(item.title, `Topic ${index + 1}`),
      objective: text(item.objective, "Explore the participant's experience."),
      questions: strings(item.questions),
      probes: strings(item.probes),
    }];
  });
  if (topics.length === 0 || topics.some((topic) => topic.questions.length === 0)) {
    throw new Error("The generated guide did not include usable interview questions");
  }
  return {
    title: text(record.title, `${studyTitle} interview guide`),
    researchObjective: text(record.researchObjective, "Understand the participant's experience."),
    respondentProfile: text(record.respondentProfile, "Target study participant"),
    estimatedMinutes: Math.min(60, Math.max(5, Number(record.estimatedMinutes) || 15)),
    openingScript: text(record.openingScript, "Thank you for taking part in this research."),
    topics,
    closingScript: text(record.closingScript, "Thank you. Your feedback will inform this study."),
    guardrails: strings(record.guardrails),
  };
}

async function recordAudit(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  studyId: Id<"studies">,
  userId: Id<"users">,
  version: number,
  now: number,
) {
  await ctx.db.insert("auditEvents", {
    organizationId,
    studyId,
    actorUserId: userId,
    actorType: "user",
    eventType: "interview_brief.approved",
    summary: `Approved interview guide version ${version}`,
    metadata: { version },
    createdAt: now,
  });
}
