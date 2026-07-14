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

async function requireChatAccess(
  ctx: Pick<QueryCtx, "auth" | "db">,
  chatSessionId: Id<"chatSessions">,
) {
  const user = await requireUser(ctx);
  const chatSession = await ctx.db.get(chatSessionId);
  if (!chatSession || chatSession.organizationId !== user.defaultOrganizationId) {
    throw new Error("Chat not found");
  }

  const study = await ctx.db.get(chatSession.studyId);
  if (!study || study.organizationId !== user.defaultOrganizationId) {
    throw new Error("Study not found");
  }

  return { user, study, chatSession };
}

export const listForChat = query({
  args: {
    chatSessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    await requireChatAccess(ctx, args.chatSessionId);
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", args.chatSessionId))
      .order("desc")
      .collect();
  },
});

export const createQueued = mutation({
  args: {
    chatSessionId: v.id("chatSessions"),
    activeSkillNames: v.array(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, study, chatSession } = await requireChatAccess(ctx, args.chatSessionId);
    if (chatSession.activeAgentRunId) {
      throw new Error("This chat already has an active agent run");
    }

    const now = Date.now();
    const agentRunId = await ctx.db.insert("agentRuns", {
      organizationId: chatSession.organizationId,
      studyId: study._id,
      chatSessionId: chatSession._id,
      status: "queued",
      activeSkillNames: args.activeSkillNames,
      model: args.model,
      startedBy: user._id,
      startedAt: now,
    });

    await ctx.db.patch(chatSession._id, {
      activeAgentRunId: agentRunId,
      updatedAt: now,
    });

    return agentRunId;
  },
});

