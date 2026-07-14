import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

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
      .query("messages")
      .withIndex("by_chat_order", (q) => q.eq("chatSessionId", args.chatSessionId))
      .order("asc")
      .take(100);
  },
});

export const sendUserMessage = mutation({
  args: {
    chatSessionId: v.id("chatSessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, study, chatSession } = await requireChatAccess(ctx, args.chatSessionId);
    if (chatSession.activeAgentRunId) {
      throw new Error("Meridian is still responding in this chat");
    }

    const content = args.content.trim();
    if (!content) throw new Error("Message is required");

    const now = Date.now();
    const lastMessage = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", chatSession._id))
      .order("desc")
      .first();
    const order = (lastMessage?.order ?? -1) + 1;

    const messageId = await ctx.db.insert("messages", {
      organizationId: chatSession.organizationId,
      studyId: study._id,
      chatSessionId: chatSession._id,
      role: "user",
      content,
      parts: [{ type: "text", text: content }],
      status: "complete",
      order,
      createdAt: now,
    });

    const agentRunId = await ctx.db.insert("agentRuns", {
      organizationId: chatSession.organizationId,
      studyId: study._id,
      chatSessionId: chatSession._id,
      status: "queued",
      activeSkillNames: chatSession.activeSkillNames ?? ["research-strategy"],
      startedBy: user._id,
      startedAt: now,
    });

    const assistantMessageId = await ctx.db.insert("messages", {
      organizationId: chatSession.organizationId,
      studyId: study._id,
      chatSessionId: chatSession._id,
      role: "assistant",
      parts: [],
      status: "streaming",
      order: order + 1,
      agentRunId,
      createdAt: now,
    });

    await ctx.db.patch(chatSession._id, { updatedAt: now });
    await ctx.db.patch(study._id, { updatedAt: now });
    await ctx.db.patch(chatSession._id, {
      activeAgentRunId: agentRunId,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.meridian.processMessage, {
      agentRunId,
      assistantMessageId,
    });

    return { messageId, agentRunId, assistantMessageId };
  },
});

export const createAssistantPlaceholder = internalMutation({
  args: {
    chatSessionId: v.id("chatSessions"),
    agentRunId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const chatSession = await ctx.db.get(args.chatSessionId);
    if (!chatSession) throw new Error("Chat not found");
    const study = await ctx.db.get(chatSession.studyId);
    if (!study) throw new Error("Study not found");

    const lastMessage = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", chatSession._id))
      .order("desc")
      .first();
    const now = Date.now();

    return await ctx.db.insert("messages", {
      organizationId: chatSession.organizationId,
      studyId: study._id,
      chatSessionId: chatSession._id,
      role: "assistant",
      parts: [],
      status: "streaming",
      order: (lastMessage?.order ?? -1) + 1,
      agentRunId: args.agentRunId,
      createdAt: now,
    });
  },
});

export const appendTextDelta = internalMutation({
  args: {
    messageId: v.id("messages"),
    textDelta: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;

    const parts = [...(message.parts as Array<Record<string, unknown>>)];
    const lastPart = parts[parts.length - 1];

    if (lastPart?.type === "text") {
      parts[parts.length - 1] = {
        ...lastPart,
        text: `${String(lastPart.text ?? "")}${args.textDelta}`,
      };
    } else {
      parts.push({ type: "text", text: args.textDelta });
    }

    await ctx.db.patch(args.messageId, {
      parts,
      content: parts
        .filter((part) => part.type === "text")
        .map((part) => String(part.text ?? ""))
        .join(""),
    });
  },
});

export const finalizeAssistantMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(v.literal("complete"), v.literal("error")),
    errorText: v.optional(v.string()),
    parts: v.optional(v.array(v.any())),
    metadata: v.optional(v.string()),
    usage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"messages">> = { status: args.status };

    if (args.errorText !== undefined) {
      patch.content = args.errorText;
      patch.parts = [{ type: "text", text: args.errorText }];
    } else if (args.parts !== undefined && args.parts.length > 0) {
      patch.parts = args.parts;
      patch.content = args.parts
        .filter((part) => part?.type === "text")
        .map((part) => String(part.text ?? ""))
        .join("");
    }

    if (args.metadata !== undefined) patch.metadata = args.metadata;
    if (args.usage !== undefined) patch.usage = args.usage;

    await ctx.db.patch(args.messageId, patch);
  },
});
