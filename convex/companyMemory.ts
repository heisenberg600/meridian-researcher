import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireCurrentUser, requireOrganizationAccess } from "./lib/auth";

const categoryValidator = v.union(
  v.literal("company"),
  v.literal("product"),
  v.literal("customer"),
  v.literal("research"),
  v.literal("preference"),
  v.literal("constraint"),
  v.literal("other"),
);

type CompanyCategory = Doc<"organizationMemories">["category"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireDefaultOrganizationAccess(ctx);
    const memories = await ctx.db
      .query("organizationMemories")
      .withIndex("by_organization_and_status", (index) =>
        index.eq("organizationId", access.organizationId).eq("status", "active"),
      )
      .order("desc")
      .collect();
    return memories.filter(
      (memory) =>
        memory.organizationId === access.organizationId && memory.status === "active",
    );
  },
});

export const create = mutation({
  args: { key: v.string(), value: v.string(), category: categoryValidator },
  handler: async (ctx, args) => {
    const access = await requireDefaultOrganizationAccess(ctx);
    const draft = normalizeMemory(args.key, args.value, args.category);
    const now = Date.now();
    return await ctx.db.insert("organizationMemories", {
      organizationId: access.organizationId,
      ...draft,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    memoryId: v.id("organizationMemories"),
    key: v.optional(v.string()),
    value: v.optional(v.string()),
    category: v.optional(categoryValidator),
  },
  handler: async (ctx, args) => {
    const memory = await requireMemoryAccess(ctx, args.memoryId);
    const draft = normalizeMemory(
      args.key ?? memory.key,
      args.value ?? memory.value,
      args.category ?? memory.category,
    );
    await ctx.db.patch(memory._id, { ...draft, updatedAt: Date.now() });
  },
});

export const archive = mutation({
  args: { memoryId: v.id("organizationMemories") },
  handler: async (ctx, args) => {
    const memory = await requireMemoryAccess(ctx, args.memoryId);
    await ctx.db.patch(memory._id, { status: "archived", updatedAt: Date.now() });
  },
});

export const upsert = mutation({
  args: { key: v.string(), value: v.string(), category: categoryValidator },
  handler: async (ctx, args) => {
    const access = await requireDefaultOrganizationAccess(ctx);
    return await upsertMemory(ctx, access.organizationId, args);
  },
});

export const upsertFromAgent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    key: v.string(),
    value: v.string(),
    category: categoryValidator,
  },
  handler: async (ctx, args) => upsertMemory(ctx, args.organizationId, args),
});

async function requireMemoryAccess(ctx: QueryCtx | MutationCtx, memoryId: Id<"organizationMemories">) {
  const access = await requireDefaultOrganizationAccess(ctx);
  const memory = await ctx.db.get(memoryId);
  if (!memory || memory.organizationId !== access.organizationId) {
    throw new Error("Memory not found");
  }
  return memory;
}

async function requireDefaultOrganizationAccess(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  return await requireOrganizationAccess(ctx, user.defaultOrganizationId!);
}

function normalizeMemory(key: string, value: string, category: CompanyCategory) {
  const normalized = { key: key.trim(), value: value.trim(), category };
  if (!normalized.key || !normalized.value) throw new Error("Memory key and value are required");
  return normalized;
}

function normalizeKey(key: string) {
  return key.trim().toLocaleLowerCase();
}

async function upsertMemory(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  args: { key: string; value: string; category: CompanyCategory },
) {
  const draft = normalizeMemory(args.key, args.value, args.category);
  const memories = await ctx.db
    .query("organizationMemories")
    .withIndex("by_organization", (index) => index.eq("organizationId", organizationId))
    .collect();
  const existing = memories.find(
    (memory) =>
      memory.organizationId === organizationId &&
      normalizeKey(memory.key) === normalizeKey(draft.key),
  );
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...draft, status: "active", updatedAt: now });
    return existing._id;
  }
  return await ctx.db.insert("organizationMemories", {
    organizationId,
    ...draft,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}
