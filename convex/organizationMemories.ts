import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

const categoryValidator = v.union(
  v.literal("company"),
  v.literal("product"),
  v.literal("customer"),
  v.literal("research"),
  v.literal("preference"),
  v.literal("constraint"),
  v.literal("other"),
);

async function requireUser(ctx: Pick<QueryCtx, "auth" | "db">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user?.defaultOrganizationId) throw new Error("User workspace has not been initialized");
  return user;
}

function clampScore(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

export const listMine = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.defaultOrganizationId;
    if (!organizationId) throw new Error("User workspace has not been initialized");
    const query = args.includeArchived
      ? ctx.db
          .query("organizationMemories")
          .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      : ctx.db
          .query("organizationMemories")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", organizationId).eq("status", "active"),
          );

    return await query.order("desc").take(100);
  },
});

export const archive = mutation({
  args: {
    memoryId: v.id("organizationMemories"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.organizationId !== user.defaultOrganizationId) {
      throw new Error("Memory not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.memoryId, {
      status: "archived",
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: memory.organizationId,
      actorUserId: user._id,
      actorType: "user",
      eventType: "organization_memory.archived",
      summary: `Archived organization memory "${memory.key}"`,
      metadata: { memoryId: args.memoryId },
      createdAt: now,
    });
  },
});

export const listForAgent = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationMemories")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "active"),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 30, 100));
  },
});

export const upsertFromAgent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    agentRunId: v.id("agentRuns"),
    sourceMessageId: v.optional(v.id("messages")),
    key: v.string(),
    value: v.string(),
    category: categoryValidator,
    importance: v.number(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const key = args.key.trim().toLowerCase();
    const value = args.value.trim();
    if (!key || !value) throw new Error("Memory key and value are required");

    const now = Date.now();
    const existing = await ctx.db
      .query("organizationMemories")
      .withIndex("by_organization_and_key", (q) =>
        q.eq("organizationId", args.organizationId).eq("key", key),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value,
        category: args.category,
        status: "active",
        importance: clampScore(args.importance, existing.importance),
        confidence: clampScore(args.confidence, existing.confidence),
        source: "agent",
        sourceMessageId: args.sourceMessageId,
        updatedByAgentRunId: args.agentRunId,
        updatedAt: now,
      });
      await writeMemoryAudit(ctx, {
        organizationId: args.organizationId,
        agentRunId: args.agentRunId,
        eventType: "organization_memory.updated",
        summary: `Updated organization memory "${key}"`,
        memoryId: existing._id,
      });
      return existing._id;
    }

    const memoryId = await ctx.db.insert("organizationMemories", {
      organizationId: args.organizationId,
      key,
      value,
      category: args.category,
      status: "active",
      importance: clampScore(args.importance, 0.5),
      confidence: clampScore(args.confidence, 0.5),
      source: "agent",
      sourceMessageId: args.sourceMessageId,
      createdByAgentRunId: args.agentRunId,
      updatedByAgentRunId: args.agentRunId,
      createdAt: now,
      updatedAt: now,
    });
    await writeMemoryAudit(ctx, {
      organizationId: args.organizationId,
      agentRunId: args.agentRunId,
      eventType: "organization_memory.created",
      summary: `Created organization memory "${key}"`,
      memoryId,
    });
    return memoryId;
  },
});

export const archiveFromAgent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    agentRunId: v.id("agentRuns"),
    key: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const key = args.key.trim().toLowerCase();
    const existing = await ctx.db
      .query("organizationMemories")
      .withIndex("by_organization_and_key", (q) =>
        q.eq("organizationId", args.organizationId).eq("key", key),
      )
      .unique();
    if (!existing) return null;

    await ctx.db.patch(existing._id, {
      status: "archived",
      updatedByAgentRunId: args.agentRunId,
      updatedAt: Date.now(),
    });
    await writeMemoryAudit(ctx, {
      organizationId: args.organizationId,
      agentRunId: args.agentRunId,
      eventType: "organization_memory.archived_by_agent",
      summary: `Archived organization memory "${key}"`,
      memoryId: existing._id,
      metadata: { reason: args.reason },
    });
    return existing._id;
  },
});

export const markUsed = internalMutation({
  args: {
    memoryIds: v.array(v.id("organizationMemories")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const memoryId of args.memoryIds) {
      await ctx.db.patch(memoryId, { lastUsedAt: now });
    }
  },
});

async function writeMemoryAudit(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    agentRunId: Id<"agentRuns">;
    eventType: string;
    summary: string;
    memoryId: Id<"organizationMemories">;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.db.insert("auditEvents", {
    organizationId: args.organizationId,
    actorType: "agent",
    eventType: args.eventType,
    summary: args.summary,
    metadata: {
      ...(args.metadata ?? {}),
      memoryId: args.memoryId,
      agentRunId: args.agentRunId,
    },
    createdAt: Date.now(),
  });
}
