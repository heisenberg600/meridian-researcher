import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";

const categoryValidator = v.union(
  v.literal("decision"),
  v.literal("audience"),
  v.literal("hypothesis"),
  v.literal("constraint"),
  v.literal("preference"),
  v.literal("other"),
);

type StudyCategory = Doc<"studyMemories">["category"];

export const list = query({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args) => {
    const access = await requireStudyAccess(ctx, args.studyId);
    const memories = await ctx.db
      .query("studyMemories")
      .withIndex("by_study_status", (index) =>
        index.eq("studyId", args.studyId).eq("status", "active"),
      )
      .order("desc")
      .collect();
    return memories.filter(
      (memory) =>
        memory.studyId === args.studyId &&
        memory.organizationId === access.organizationId &&
        memory.status === "active",
    );
  },
});

export const create = mutation({
  args: {
    studyId: v.id("studies"),
    key: v.string(),
    value: v.string(),
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStudyAccess(ctx, args.studyId);
    const draft = normalizeMemory(args.key, args.value, args.category);
    const now = Date.now();
    return await ctx.db.insert("studyMemories", {
      organizationId: access.organizationId,
      studyId: args.studyId,
      ...draft,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    memoryId: v.id("studyMemories"),
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
  args: { memoryId: v.id("studyMemories") },
  handler: async (ctx, args) => {
    const memory = await requireMemoryAccess(ctx, args.memoryId);
    await ctx.db.patch(memory._id, { status: "archived", updatedAt: Date.now() });
  },
});

export const upsert = mutation({
  args: {
    studyId: v.id("studies"),
    key: v.string(),
    value: v.string(),
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStudyAccess(ctx, args.studyId);
    return await upsertMemory(ctx, access.organizationId, args.studyId, args);
  },
});

export const upsertFromAgent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    key: v.string(),
    value: v.string(),
    category: categoryValidator,
  },
  handler: async (ctx, args) => {
    const study = await ctx.db.get(args.studyId);
    if (!study || study.organizationId !== args.organizationId) throw new Error("Study not found");
    return await upsertMemory(ctx, args.organizationId, args.studyId, args);
  },
});

async function requireMemoryAccess(ctx: QueryCtx | MutationCtx, memoryId: Id<"studyMemories">) {
  const memory = await ctx.db.get(memoryId);
  if (!memory) throw new Error("Memory not found");
  const access = await requireStudyAccess(ctx, memory.studyId);
  if (memory.organizationId !== access.organizationId) throw new Error("Memory not found");
  return memory;
}

function normalizeMemory(key: string, value: string, category: StudyCategory) {
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
  studyId: Id<"studies">,
  args: { key: string; value: string; category: StudyCategory },
) {
  const draft = normalizeMemory(args.key, args.value, args.category);
  const memories = await ctx.db
    .query("studyMemories")
    .withIndex("by_study", (index) => index.eq("studyId", studyId))
    .collect();
  const existing = memories.find(
    (memory) =>
      memory.studyId === studyId &&
      memory.organizationId === organizationId &&
      normalizeKey(memory.key) === normalizeKey(draft.key),
  );
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...draft, status: "active", updatedAt: now });
    return existing._id;
  }
  return await ctx.db.insert("studyMemories", {
    organizationId,
    studyId,
    ...draft,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}
