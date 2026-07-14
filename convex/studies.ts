import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

async function requireUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user) throw new Error("User profile has not been initialized");
  if (!user.defaultOrganizationId) throw new Error("User workspace has not been initialized");
  return user;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("studies")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: {
    studyId: v.id("studies"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const study = await ctx.db.get(args.studyId);
    if (!study || study.organizationId !== user.defaultOrganizationId) return null;
    return study;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    businessDecision: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.defaultOrganizationId;
    if (!organizationId) throw new Error("User workspace has not been initialized");

    const title = args.title.trim();
    const businessDecision = args.businessDecision.trim();

    if (!title || !businessDecision) {
      throw new Error("Title and business decision are required");
    }

    const now = Date.now();
    const studyId = await ctx.db.insert("studies", {
      organizationId,
      ownerId: user._id,
      title,
      businessDecision,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    const chatSessionId = await ctx.db.insert("chatSessions", {
      organizationId,
      studyId,
      title: "Strategy discussion",
      purpose: "strategy",
      status: "active",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditEvents", {
      organizationId,
      studyId,
      actorUserId: user._id,
      actorType: "user",
      eventType: "study.created",
      summary: `Created study "${title}"`,
      createdAt: now,
    });

    return { studyId, chatSessionId };
  },
});
