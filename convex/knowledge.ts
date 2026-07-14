import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireCurrentUser, requireOrganizationAccess, requireStudyAccess } from "./lib/auth";
import {
  classifyKnowledgeUpload,
  normalizePublicKnowledgeLink,
  requireSourceStatusTransition,
  type SourceStatus,
} from "./knowledgeActions";

const linkKind = v.union(v.literal("website"), v.literal("public_media"));

export const list = query({
  args: { studyId: v.optional(v.id("studies")) },
  handler: async (ctx, args) => {
    const scope = await requireScope(ctx, args.studyId);
    if (args.studyId) {
      const sources = await ctx.db
        .query("knowledgeSources")
        .withIndex("by_study", (index) => index.eq("studyId", args.studyId))
        .order("desc")
        .collect();
      return sources.filter(
        (source) =>
          source.organizationId === scope.organizationId && source.studyId === args.studyId,
      );
    }

    const sources = await ctx.db
      .query("knowledgeSources")
      .withIndex("by_organization", (index) => index.eq("organizationId", scope.organizationId))
      .order("desc")
      .collect();
    return sources.filter(
      (source) => source.organizationId === scope.organizationId && source.studyId === undefined,
    );
  },
});

export const generateUploadUrl = mutation({
  args: { studyId: v.optional(v.id("studies")) },
  handler: async (ctx, args) => {
    await requireScope(ctx, args.studyId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const submitLink = mutation({
  args: {
    studyId: v.optional(v.id("studies")),
    kind: linkKind,
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireScope(ctx, args.studyId);
    const input = normalizePublicKnowledgeLink(args.kind, args.url);
    const now = Date.now();
    const sourceId = await ctx.db.insert("knowledgeSources", {
      organizationId: scope.organizationId,
      studyId: args.studyId,
      kind: input.kind,
      url: input.url,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.knowledgeActions.processSource, { sourceId });
    return sourceId;
  },
});

export const submitUpload = mutation({
  args: {
    studyId: v.optional(v.id("studies")),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireScope(ctx, args.studyId);
    const filename = args.filename.trim();
    if (!filename) throw new Error("A filename is required");
    const kind = classifyKnowledgeUpload(filename, args.contentType);
    const now = Date.now();
    const sourceId = await ctx.db.insert("knowledgeSources", {
      organizationId: scope.organizationId,
      studyId: args.studyId,
      kind,
      storageId: args.storageId,
      filename,
      contentType: args.contentType.trim() || "application/octet-stream",
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.knowledgeActions.processSource, { sourceId });
    return sourceId;
  },
});

export const retry = mutation({
  args: { sourceId: v.id("knowledgeSources") },
  handler: async (ctx, args) => {
    const source = await requireSourceAccess(ctx, args.sourceId);
    requireSourceStatusTransition(source.status, "queued");
    await ctx.db.patch(source._id, {
      status: "queued",
      error: undefined,
      extractedSummary: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.knowledgeActions.processSource, { sourceId: source._id });
  },
});

export const remove = mutation({
  args: { sourceId: v.id("knowledgeSources") },
  handler: async (ctx, args) => {
    const source = await requireSourceAccess(ctx, args.sourceId);
    if (source.storageId) await ctx.storage.delete(source.storageId);
    await ctx.db.delete(source._id);
  },
});

export const beginProcessing = internalMutation({
  args: { sourceId: v.id("knowledgeSources") },
  handler: async (ctx, args) => transitionSource(ctx, args.sourceId, "processing"),
});

export const completeProcessing = internalMutation({
  args: { sourceId: v.id("knowledgeSources"), extractedSummary: v.string() },
  handler: async (ctx, args) => transitionSource(ctx, args.sourceId, "ready", { summary: args.extractedSummary }),
});

export const failProcessing = internalMutation({
  args: { sourceId: v.id("knowledgeSources"), error: v.string() },
  handler: async (ctx, args) => transitionSource(ctx, args.sourceId, "failed", { error: args.error }),
});

export const getProcessingSource = internalQuery({
  args: { sourceId: v.id("knowledgeSources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return null;
    return {
      ...source,
      storageUrl: source.storageId ? await ctx.storage.getUrl(source.storageId) : undefined,
    };
  },
});

async function requireScope(ctx: QueryCtx | MutationCtx, studyId?: Id<"studies">) {
  if (studyId) {
    const access = await requireStudyAccess(ctx, studyId);
    return { organizationId: access.organizationId, user: access.user };
  }
  return await requireDefaultOrganizationAccess(ctx);
}

async function requireSourceAccess(ctx: QueryCtx | MutationCtx, sourceId: Id<"knowledgeSources">) {
  const source = await ctx.db.get(sourceId);
  if (!source) throw new Error("Source not found");
  if (source.studyId) {
    const access = await requireStudyAccess(ctx, source.studyId);
    if (access.organizationId !== source.organizationId) throw new Error("Source not found");
  } else {
    const access = await requireDefaultOrganizationAccess(ctx);
    if (access.organizationId !== source.organizationId) throw new Error("Source not found");
  }
  return source;
}

async function requireDefaultOrganizationAccess(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  return await requireOrganizationAccess(ctx, user.defaultOrganizationId!);
}

async function transitionSource(
  ctx: MutationCtx,
  sourceId: Id<"knowledgeSources">,
  status: SourceStatus,
  details: { summary?: string; error?: string } = {},
) {
  const source = await ctx.db.get(sourceId);
  if (!source) throw new Error("Source not found");
  requireSourceStatusTransition(source.status, status, details);
  const patch: Partial<Doc<"knowledgeSources">> = { status, updatedAt: Date.now() };
  if (status === "ready") {
    patch.extractedSummary = details.summary!.trim();
    patch.error = undefined;
  }
  if (status === "failed") {
    patch.error = details.error!.trim();
  }
  await ctx.db.patch(sourceId, patch);
}
