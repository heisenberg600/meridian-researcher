import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";

const BUILTIN_RESEARCH_STRATEGY_SKILL = {
  id: null,
  name: "research-strategy",
  description: "Turn a business decision into an approvable customer research study plan.",
  content: [
    "---",
    "name: research-strategy",
    "description: Turn a business decision into an approvable customer research study plan.",
    "when_to_use: Use while a study is in draft or strategy discussion.",
    "allowed_tools:",
    "  - web_search",
    "  - remember_organization_context",
    "  - forget_organization_memory",
    "  - sandbox_bash",
    "  - sandbox_read_file",
    "output_contract:",
    "  - Ask concise questions until the decision, audience, constraints, and risks are clear.",
    "  - When ready, draft a study plan with goals, hypotheses, audience, method, screener, guide outline, risks, and approval checklist.",
    "validation_checklist:",
    "  - Separate facts, assumptions, hypotheses, and recommendations.",
    "  - Do not imply fieldwork or outreach has started.",
    "  - Surface unknowns and decision risks explicitly.",
    "---",
    "",
    "# Research Strategy",
    "",
    "Help the user transform a business decision into a supervised research plan.",
    "Prefer a few high-value questions over a long questionnaire.",
    "Use the sandbox for scratch calculations, table shaping, and private notes when useful.",
  ].join("\n"),
  version: 1,
  scope: "global" as const,
};

export type ResolvedAgentSkill = {
  id: Id<"agentSkills"> | null;
  name: string;
  description: string;
  content: string;
  version: number;
  scope: Doc<"agentSkills">["scope"];
};

export const getRunContext = internalQuery({
  args: {
    agentRunId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run) throw new Error("Agent run not found");

    const [study, chatSession, messages, memories, activeSkills] = await Promise.all([
      ctx.db.get(run.studyId),
      ctx.db.get(run.chatSessionId),
      ctx.db
        .query("messages")
        .withIndex("by_chat_order", (q) => q.eq("chatSessionId", run.chatSessionId))
        .order("asc")
        .take(40),
      ctx.db
        .query("organizationMemories")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", run.organizationId).eq("status", "active"),
        )
        .order("desc")
        .take(30),
      resolveActiveSkills(ctx, run),
    ]);

    if (!study) throw new Error("Study not found");
    if (!chatSession) throw new Error("Chat session not found");

    const currentPlan = study.currentStudyPlanVersionId
      ? await ctx.db.get(study.currentStudyPlanVersionId)
      : null;

    return { run, study, chatSession, messages, memories, activeSkills, currentPlan };
  },
});

export const setRunRunning = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run) throw new Error("Agent run not found");

    await ctx.db.patch(args.agentRunId, {
      status: "running",
      model: args.model,
    });

    const existingActivations = await ctx.db
      .query("studySkillActivations")
      .withIndex("by_run", (q) => q.eq("agentRunId", args.agentRunId))
      .collect();
    const existingNames = new Set(existingActivations.map((activation) => activation.skillName));
    const activeSkills = await resolveActiveSkills(ctx, run);
    for (const skill of activeSkills) {
      if (!skill.id || existingNames.has(skill.name)) continue;
      await ctx.db.insert("studySkillActivations", {
        organizationId: run.organizationId,
        studyId: run.studyId,
        agentRunId: args.agentRunId,
        skillId: skill.id,
        skillName: skill.name,
        skillVersion: skill.version,
        activatedAt: Date.now(),
      });
    }
  },
});

export const setRunTrace = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    laminarTraceId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentRunId, {
      laminarTraceId: args.laminarTraceId,
    });
  },
});

export const completeRun = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    chatSessionId: v.id("chatSessions"),
    totalCostUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.agentRunId, {
      status: "completed",
      completedAt: now,
      totalCostUsd: args.totalCostUsd,
    });
    await ctx.db.patch(args.chatSessionId, {
      activeAgentRunId: undefined,
      updatedAt: now,
    });
  },
});

export const failRun = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    chatSessionId: v.id("chatSessions"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.agentRunId, {
      status: "failed",
      completedAt: now,
      error: args.error,
    });
    await ctx.db.patch(args.chatSessionId, {
      activeAgentRunId: undefined,
      updatedAt: now,
    });
  },
});

export const recordUsage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    agentRunId: v.id("agentRuns"),
    operation: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    costUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageLedger", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      agentRunId: args.agentRunId,
      operation: args.operation,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      costUsd: args.costUsd,
      createdAt: Date.now(),
    });
  },
});

export const startToolEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    agentRunId: v.id("agentRuns"),
    toolName: v.string(),
    input: v.optional(v.any()),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentToolEvents", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      agentRunId: args.agentRunId,
      toolName: args.toolName,
      status: "started",
      input: args.input,
      startedAt: args.startedAt,
    });
  },
});

export const finishToolEvent = internalMutation({
  args: {
    toolEventId: v.id("agentToolEvents"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.toolEventId, {
      status: args.status,
      output: args.output,
      error: args.error,
      completedAt: Date.now(),
    });
  },
});

export const latestWorkspaceSnapshot = internalQuery({
  args: {
    chatSessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaceSnapshots")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", args.chatSessionId))
      .order("desc")
      .first();
  },
});

export const recordWorkspaceSnapshot = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    storageId: v.id("_storage"),
    compressedSizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("workspaceSnapshots", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      storageId: args.storageId,
      compressedSizeBytes: args.compressedSizeBytes,
      createdAt: Date.now(),
    });
  },
});

async function resolveActiveSkills(
  ctx: Pick<QueryCtx, "db">,
  run: Doc<"agentRuns">,
): Promise<ResolvedAgentSkill[]> {
  const activeSkillNames =
    run.activeSkillNames.length > 0 ? run.activeSkillNames : ["research-strategy"];
  const resolved: ResolvedAgentSkill[] = [];

  for (const name of activeSkillNames) {
    const rows = await ctx.db
      .query("agentSkills")
      .withIndex("by_name", (q) => q.eq("name", name))
      .collect();
    const candidates = rows
      .filter((skill) => skill.isActive)
      .filter(
        (skill) =>
          skill.scope === "global" ||
          skill.organizationId === run.organizationId ||
          skill.ownerUserId === run.startedBy,
      )
      .sort((a, b) => skillRank(b, run) - skillRank(a, run) || b.version - a.version);

    const selected = candidates[0];
    if (selected) {
      resolved.push({
        id: selected._id,
        name: selected.name,
        description: selected.description,
        content: selected.content,
        version: selected.version,
        scope: selected.scope,
      });
      continue;
    }

    if (name === BUILTIN_RESEARCH_STRATEGY_SKILL.name) {
      resolved.push(BUILTIN_RESEARCH_STRATEGY_SKILL);
    }
  }

  return resolved;
}

function skillRank(skill: Doc<"agentSkills">, run: Doc<"agentRuns">) {
  if (skill.ownerUserId === run.startedBy) return 3;
  if (skill.organizationId === run.organizationId) return 2;
  if (skill.scope === "global") return 1;
  return 0;
}
