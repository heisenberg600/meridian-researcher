import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";

type SeedResult = {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  studyId: Id<"studies">;
  chatSessionId: Id<"chatSessions">;
  agentRunId: Id<"agentRuns">;
  assistantMessageId: Id<"messages">;
};

export const runChatSandboxE2E = action({
  args: {},
  handler: async (ctx) => {
    if (process.env.SANDBOX_E2E_ENABLED !== "true") {
      throw new Error("Sandbox e2e is disabled. Set SANDBOX_E2E_ENABLED=true to run it.");
    }

    const seed: SeedResult = await ctx.runMutation(
      makeFunctionReference<"mutation">("sandboxE2E:seedChatSandboxE2E"),
      {},
    );

    await ctx.runAction(internal.meridian.processMessage, {
      agentRunId: seed.agentRunId,
      assistantMessageId: seed.assistantMessageId,
    });

    const result: E2EResult = await ctx.runQuery(
      makeFunctionReference<"query">("sandboxE2E:getChatSandboxE2EResult"),
      {
        ...seed,
      },
    );

    return {
      ...result,
      passed:
        result.run.status === "completed" &&
        result.assistant.status === "complete" &&
        result.sandboxEvents.some(
          (event) =>
            event.toolName === "sandbox_bash" &&
            JSON.stringify(event.output ?? {}).includes("skill-mounted-ok"),
        ) &&
        result.sandboxEvents.some((event) => event.toolName === "sandbox_read_file") &&
        result.assistantText.toLowerCase().includes("sandbox-ok"),
    };
  },
});

export const runWorkspacePersistenceE2E = action({
  args: {},
  handler: async (ctx) => {
    if (process.env.SANDBOX_E2E_ENABLED !== "true") {
      throw new Error("Sandbox e2e is disabled. Set SANDBOX_E2E_ENABLED=true to run it.");
    }

    const first: SeedResult = await ctx.runMutation(
      makeFunctionReference<"mutation">("sandboxE2E:seedPersistenceE2E"),
      {},
    );
    await ctx.runAction(internal.meridian.processMessage, {
      agentRunId: first.agentRunId,
      assistantMessageId: first.assistantMessageId,
    });

    const second: Pick<SeedResult, "agentRunId" | "assistantMessageId"> = await ctx.runMutation(
      makeFunctionReference<"mutation">("sandboxE2E:createPersistenceSecondTurn"),
      {
        organizationId: first.organizationId,
        userId: first.userId,
        studyId: first.studyId,
        chatSessionId: first.chatSessionId,
      },
    );
    await ctx.runAction(internal.meridian.processMessage, {
      agentRunId: second.agentRunId,
      assistantMessageId: second.assistantMessageId,
    });

    const result: PersistenceE2EResult = await ctx.runQuery(
      makeFunctionReference<"query">("sandboxE2E:getPersistenceE2EResult"),
      {
        chatSessionId: first.chatSessionId,
        secondAgentRunId: second.agentRunId,
        secondAssistantMessageId: second.assistantMessageId,
      },
    );

    return {
      ...result,
      passed:
        result.secondRun.status === "completed" &&
        result.secondAssistant.status === "complete" &&
        result.snapshotCount >= 1 &&
        result.secondSandboxEvents.some(
          (event) =>
            event.toolName === "sandbox_read_file" &&
            JSON.stringify(event.output ?? {}).includes("persisted-ok"),
        ),
    };
  },
});

export const seedChatSandboxE2E = internalMutation({
  args: {},
  handler: async (ctx): Promise<SeedResult> => {
    const now = Date.now();
    const marker = `sandbox-e2e-${now}`;
    const userId = await ctx.db.insert("users", {
      authTokenIdentifier: marker,
      email: `${marker}@example.test`,
      name: "Sandbox E2E",
      lastSeenAt: now,
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Sandbox E2E workspace",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, { defaultOrganizationId: organizationId });
    await ctx.db.insert("memberships", {
      organizationId,
      userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
    const studyId = await ctx.db.insert("studies", {
      organizationId,
      ownerId: userId,
      title: "Sandbox E2E study",
      businessDecision:
        "Verify that Meridian can use its private sandbox during an end-to-end chat run.",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const chatSessionId = await ctx.db.insert("chatSessions", {
      organizationId,
      studyId,
      title: "Sandbox E2E chat",
      purpose: "strategy",
      status: "active",
      activeSkillNames: ["sandbox-e2e"],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("agentSkills", {
      organizationId,
      name: "sandbox-e2e",
      description: "Verify skill loading and sandbox mounting.",
      content: [
        "---",
        "name: sandbox-e2e",
        "description: Verify skill loading and sandbox mounting.",
        "---",
        "",
        "# Sandbox E2E",
        "",
        "When asked to run the sandbox e2e, confirm this marker: skill-mounted-ok.",
      ].join("\n"),
      scope: "organization",
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("messages", {
      organizationId,
      studyId,
      chatSessionId,
      role: "user",
      content:
        "This is a sandbox e2e test. Use sandbox_bash to run exactly: grep skill-mounted-ok .agents/skills/sandbox-e2e/SKILL.md && printf 'sandbox-ok' > result.txt && cat result.txt. Then use sandbox_read_file to read result.txt. Reply with the command stdout and the file contents.",
      parts: [
        {
          type: "text",
          text: "This is a sandbox e2e test. Use sandbox_bash to run exactly: grep skill-mounted-ok .agents/skills/sandbox-e2e/SKILL.md && printf 'sandbox-ok' > result.txt && cat result.txt. Then use sandbox_read_file to read result.txt. Reply with the command stdout and the file contents.",
        },
      ],
      status: "complete",
      order: 0,
      createdAt: now,
    });
    const agentRunId = await ctx.db.insert("agentRuns", {
      organizationId,
      studyId,
      chatSessionId,
      status: "queued",
      activeSkillNames: ["sandbox-e2e"],
      startedBy: userId,
      startedAt: now,
    });
    const assistantMessageId = await ctx.db.insert("messages", {
      organizationId,
      studyId,
      chatSessionId,
      role: "assistant",
      parts: [],
      status: "streaming",
      order: 1,
      agentRunId,
      createdAt: now,
    });
    await ctx.db.patch(chatSessionId, {
      activeAgentRunId: agentRunId,
      updatedAt: now,
    });

    return { organizationId, userId, studyId, chatSessionId, agentRunId, assistantMessageId };
  },
});

export const seedPersistenceE2E = internalMutation({
  args: {},
  handler: async (ctx): Promise<SeedResult> => {
    const now = Date.now();
    const marker = `sandbox-persistence-e2e-${now}`;
    const userId = await ctx.db.insert("users", {
      authTokenIdentifier: marker,
      email: `${marker}@example.test`,
      name: "Sandbox Persistence E2E",
      lastSeenAt: now,
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Sandbox Persistence E2E workspace",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, { defaultOrganizationId: organizationId });
    await ctx.db.insert("memberships", {
      organizationId,
      userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
    const studyId = await ctx.db.insert("studies", {
      organizationId,
      ownerId: userId,
      title: "Sandbox persistence E2E study",
      businessDecision: "Verify sandbox files persist across Convex chat turns.",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const chatSessionId = await ctx.db.insert("chatSessions", {
      organizationId,
      studyId,
      title: "Sandbox persistence E2E chat",
      purpose: "strategy",
      status: "active",
      activeSkillNames: ["research-strategy"],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("messages", {
      organizationId,
      studyId,
      chatSessionId,
      role: "user",
      content:
        "Persistence test turn one. Use sandbox_bash exactly: printf 'persisted-ok' > durable.txt && cat durable.txt. Reply with the stdout.",
      parts: [
        {
          type: "text",
          text: "Persistence test turn one. Use sandbox_bash exactly: printf 'persisted-ok' > durable.txt && cat durable.txt. Reply with the stdout.",
        },
      ],
      status: "complete",
      order: 0,
      createdAt: now,
    });
    const agentRunId = await ctx.db.insert("agentRuns", {
      organizationId,
      studyId,
      chatSessionId,
      status: "queued",
      activeSkillNames: ["research-strategy"],
      startedBy: userId,
      startedAt: now,
    });
    const assistantMessageId = await ctx.db.insert("messages", {
      organizationId,
      studyId,
      chatSessionId,
      role: "assistant",
      parts: [],
      status: "streaming",
      order: 1,
      agentRunId,
      createdAt: now,
    });
    await ctx.db.patch(chatSessionId, {
      activeAgentRunId: agentRunId,
      updatedAt: now,
    });

    return { organizationId, userId, studyId, chatSessionId, agentRunId, assistantMessageId };
  },
});

export const createPersistenceSecondTurn = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args): Promise<Pick<SeedResult, "agentRunId" | "assistantMessageId">> => {
    const now = Date.now();
    const lastMessage = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", args.chatSessionId))
      .order("desc")
      .first();
    const order = (lastMessage?.order ?? 1) + 1;

    await ctx.db.insert("messages", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      role: "user",
      content:
        "Persistence test turn two. Use sandbox_read_file to read durable.txt. Reply only with the file content.",
      parts: [
        {
          type: "text",
          text: "Persistence test turn two. Use sandbox_read_file to read durable.txt. Reply only with the file content.",
        },
      ],
      status: "complete",
      order,
      createdAt: now,
    });
    const agentRunId = await ctx.db.insert("agentRuns", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      status: "queued",
      activeSkillNames: ["research-strategy"],
      startedBy: args.userId,
      startedAt: now,
    });
    const assistantMessageId = await ctx.db.insert("messages", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      role: "assistant",
      parts: [],
      status: "streaming",
      order: order + 1,
      agentRunId,
      createdAt: now,
    });
    await ctx.db.patch(args.chatSessionId, {
      activeAgentRunId: agentRunId,
      updatedAt: now,
    });

    return { agentRunId, assistantMessageId };
  },
});

type E2EResult = {
  run: Doc<"agentRuns">;
  assistant: Doc<"messages">;
  assistantText: string;
  sandboxEvents: Doc<"agentToolEvents">[];
};

export const getChatSandboxE2EResult = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    agentRunId: v.id("agentRuns"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, args): Promise<E2EResult> => {
    const run = await ctx.db.get(args.agentRunId);
    const assistant = await ctx.db.get(args.assistantMessageId);
    if (!run || !assistant) throw new Error("Sandbox e2e records were not found");

    const events = await ctx.db
      .query("agentToolEvents")
      .withIndex("by_run", (q) => q.eq("agentRunId", args.agentRunId))
      .collect();
    const sandboxEvents = events.filter((event) => event.toolName.startsWith("sandbox_"));
    const assistantText =
      assistant.content ??
      (assistant.parts as Array<Record<string, unknown>>)
        .filter((part) => part.type === "text")
        .map((part) => String(part.text ?? ""))
        .join("");

    return {
      run,
      assistant,
      assistantText,
      sandboxEvents,
    };
  },
});

type PersistenceE2EResult = {
  secondRun: Doc<"agentRuns">;
  secondAssistant: Doc<"messages">;
  secondAssistantText: string;
  secondSandboxEvents: Doc<"agentToolEvents">[];
  snapshotCount: number;
};

export const getPersistenceE2EResult = internalQuery({
  args: {
    chatSessionId: v.id("chatSessions"),
    secondAgentRunId: v.id("agentRuns"),
    secondAssistantMessageId: v.id("messages"),
  },
  handler: async (ctx, args): Promise<PersistenceE2EResult> => {
    const secondRun = await ctx.db.get(args.secondAgentRunId);
    const secondAssistant = await ctx.db.get(args.secondAssistantMessageId);
    if (!secondRun || !secondAssistant) {
      throw new Error("Sandbox persistence e2e records were not found");
    }

    const secondEvents = await ctx.db
      .query("agentToolEvents")
      .withIndex("by_run", (q) => q.eq("agentRunId", args.secondAgentRunId))
      .collect();
    const snapshots = await ctx.db
      .query("workspaceSnapshots")
      .withIndex("by_chat", (q) => q.eq("chatSessionId", args.chatSessionId))
      .collect();
    const secondAssistantText =
      secondAssistant.content ??
      (secondAssistant.parts as Array<Record<string, unknown>>)
        .filter((part) => part.type === "text")
        .map((part) => String(part.text ?? ""))
        .join("");

    return {
      secondRun,
      secondAssistant,
      secondAssistantText,
      secondSandboxEvents: secondEvents.filter((event) => event.toolName.startsWith("sandbox_")),
      snapshotCount: snapshots.length,
    };
  },
});
