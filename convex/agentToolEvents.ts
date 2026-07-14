import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

async function requireChatAccess(ctx: QueryCtx, chatSessionId: Id<"chatSessions">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  const chatSession = await ctx.db.get(chatSessionId);

  if (!user?.defaultOrganizationId || chatSession?.organizationId !== user.defaultOrganizationId) {
    throw new Error("Chat not found");
  }
}

export const listForChat = query({
  args: { chatSessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await requireChatAccess(ctx, args.chatSessionId);
    return await ctx.db
      .query("agentToolEvents")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", args.chatSessionId))
      .order("asc")
      .collect();
  },
});
