import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

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

async function requireStudyAccess(ctx: Pick<QueryCtx, "auth" | "db">, studyId: Id<"studies">) {
  const user = await requireUser(ctx);
  const study = await ctx.db.get(studyId);
  if (!study || study.organizationId !== user.defaultOrganizationId) {
    throw new Error("Study not found");
  }
  return { user, study };
}

export const listForStudy = query({
  args: {
    studyId: v.id("studies"),
  },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    return await ctx.db
      .query("chatSessions")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    studyId: v.id("studies"),
    title: v.string(),
    purpose: v.union(
      v.literal("general"),
      v.literal("strategy"),
      v.literal("study_design"),
      v.literal("fieldwork"),
      v.literal("analysis"),
      v.literal("report"),
    ),
  },
  handler: async (ctx, args) => {
    const { user, study } = await requireStudyAccess(ctx, args.studyId);
    const title = args.title.trim();
    if (!title) throw new Error("Chat title is required");

    const now = Date.now();
    return await ctx.db.insert("chatSessions", {
      organizationId: study.organizationId,
      studyId: study._id,
      title,
      purpose: args.purpose,
      status: "active",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});
