import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getRunContext = internalQuery({
  args: {
    agentRunId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.agentRunId);
    if (!run) throw new Error("Agent run not found");

    const [study, chatSession, messages, memories] = await Promise.all([
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
    ]);

    if (!study) throw new Error("Study not found");
    if (!chatSession) throw new Error("Chat session not found");

    return { run, study, chatSession, messages, memories };
  },
});

export const setRunRunning = internalMutation({
  args: {
    agentRunId: v.id("agentRuns"),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.agentRunId, {
      status: "running",
      model: args.model,
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

export const recordToolEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    agentRunId: v.id("agentRuns"),
    toolName: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentToolEvents", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      agentRunId: args.agentRunId,
      toolName: args.toolName,
      status: args.status,
      input: args.input,
      output: args.output,
      error: args.error,
      startedAt: args.startedAt,
      completedAt: Date.now(),
    });
  },
});
