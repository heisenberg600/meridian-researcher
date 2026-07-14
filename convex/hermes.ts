"use node";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const TEXT_FLUSH_INTERVAL_MS = 250;

const memoryCategorySchema = z.enum([
  "company",
  "product",
  "customer",
  "research",
  "preference",
  "constraint",
  "other",
]);

export const processMessage = internalAction({
  args: {
    agentRunId: v.id("agentRuns"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.hermesData.getRunContext, {
      agentRunId: args.agentRunId,
    });
    const model = process.env.AI_GATEWAY_MODEL ?? process.env.HERMES_MODEL ?? DEFAULT_MODEL;
    const apiKey =
      process.env.AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_KEY;

    await ctx.runMutation(internal.hermesData.setRunRunning, {
      agentRunId: args.agentRunId,
      model,
    });

    if (!apiKey) {
      const text = [
        "Hermes is wired to the backend, but the AI Gateway key is not configured yet.",
        "Set `AI_GATEWAY_API_KEY` in Convex to enable live agent responses.",
      ].join(" ");
      await ctx.runMutation(internal.messages.appendTextDelta, {
        messageId: args.assistantMessageId,
        textDelta: text,
      });
      await ctx.runMutation(internal.messages.finalizeAssistantMessage, {
        messageId: args.assistantMessageId,
        status: "complete",
      });
      await ctx.runMutation(internal.hermesData.completeRun, {
        agentRunId: args.agentRunId,
        chatSessionId: context.chatSession._id,
      });
      return;
    }

    try {
      const provider = createOpenAICompatible({
        name: "vercel-ai-gateway",
        baseURL: AI_GATEWAY_BASE_URL,
        apiKey,
        includeUsage: true,
      });
      const tools = buildHermesTools({
        ctx,
        organizationId: context.run.organizationId,
        studyId: context.run.studyId,
        chatSessionId: context.run.chatSessionId,
        agentRunId: args.agentRunId,
        assistantMessageId: args.assistantMessageId,
      });

      const result = streamText({
        model: provider.languageModel(model),
        instructions: buildSystemInstructions(context),
        messages: buildModelMessages(context.messages, args.assistantMessageId),
        tools,
        stopWhen: stepCountIs(5),
        temperature: 0.35,
      });

      let pendingText = "";
      let lastFlush = Date.now();
      const flushText = async () => {
        if (!pendingText) return;
        const textDelta = pendingText;
        pendingText = "";
        await ctx.runMutation(internal.messages.appendTextDelta, {
          messageId: args.assistantMessageId,
          textDelta,
        });
      };

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          pendingText += part.text;
          if (Date.now() - lastFlush >= TEXT_FLUSH_INTERVAL_MS) {
            await flushText();
            lastFlush = Date.now();
          }
        }
      }
      await flushText();

      const usage = await result.usage;
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

      await ctx.runMutation(internal.messages.finalizeAssistantMessage, {
        messageId: args.assistantMessageId,
        status: "complete",
        usage: { inputTokens, outputTokens, totalTokens },
      });
      await ctx.runMutation(internal.hermesData.recordUsage, {
        organizationId: context.run.organizationId,
        studyId: context.run.studyId,
        agentRunId: args.agentRunId,
        operation: "hermes.chat",
        model,
        inputTokens,
        outputTokens,
        totalTokens,
      });
      await ctx.runMutation(internal.hermesData.completeRun, {
        agentRunId: args.agentRunId,
        chatSessionId: context.chatSession._id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hermes failed to respond.";
      await ctx.runMutation(internal.messages.finalizeAssistantMessage, {
        messageId: args.assistantMessageId,
        status: "error",
        errorText: `Hermes could not complete this response. ${message}`,
      });
      await ctx.runMutation(internal.hermesData.failRun, {
        agentRunId: args.agentRunId,
        chatSessionId: context.chatSession._id,
        error: message,
      });
    }
  },
});

function buildModelMessages(
  messages: Doc<"messages">[],
  assistantMessageId: Id<"messages">,
): ModelMessage[] {
  return messages
    .filter((message) => message._id !== assistantMessageId)
    .filter((message) => message.status === "complete")
    .map((message) => ({
      role: message.role,
      content: message.content ?? textFromParts(message.parts),
    }))
    .filter((message) => message.content.trim().length > 0);
}

function textFromParts(parts: Array<Record<string, unknown>>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""))
    .join("");
}

type HermesRunContext = {
  run: Doc<"agentRuns">;
  study: Doc<"studies">;
  chatSession: Doc<"chatSessions">;
  messages: Doc<"messages">[];
  memories: Doc<"organizationMemories">[];
};

function buildSystemInstructions(context: HermesRunContext) {
  const memories = context.memories
    .map(
      (memory) =>
        `- [${memory.category}] ${memory.key}: ${memory.value} (confidence ${memory.confidence})`,
    )
    .join("\n");

  return [
    "You are Hermes, a supervised AI product and market research agent.",
    "The user experiences one agent. Internally, behave as a research strategist when the study is in draft.",
    "Help turn the business decision into a clear, approvable research plan. Ask concise clarifying questions only when needed.",
    "Keep facts, assumptions, hypotheses, findings, and recommendations distinct.",
    "Do not claim fieldwork has happened unless evidence exists.",
    "Do not contact participants or imply outreach has started.",
    "",
    "Organization memories:",
    memories || "- No active organization memories yet.",
    "",
    "Memory tool rules:",
    "Use remember_organization_context only for durable organization-level facts, preferences, constraints, product context, customer context, or research standards that will help future studies.",
    "Do not store secrets, credentials, health data, payment data, or incidental one-off chat details.",
    "Use forget_organization_memory when the user corrects or invalidates a prior memory.",
    "",
    `Study title: ${context.study.title}`,
    `Business decision: ${context.study.businessDecision}`,
    `Study status: ${context.study.status}`,
  ].join("\n");
}

function buildHermesTools(args: {
  ctx: ActionCtx;
  organizationId: Id<"organizations">;
  studyId: Id<"studies">;
  chatSessionId: Id<"chatSessions">;
  agentRunId: Id<"agentRuns">;
  assistantMessageId: Id<"messages">;
}) {
  return {
    remember_organization_context: tool({
      description:
        "Save or update a durable organization memory that should help Hermes in future studies. Use only for stable facts, preferences, constraints, or research standards explicitly implied by the user.",
      inputSchema: z.object({
        key: z.string().min(2).max(80).describe("Stable snake_case key for the memory."),
        value: z.string().min(3).max(1000).describe("The memory text to preserve."),
        category: memoryCategorySchema,
        importance: z.number().min(0).max(1).describe("How useful this is likely to be later."),
        confidence: z.number().min(0).max(1).describe("How confident Hermes is that this memory is true."),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        try {
          const memoryId = await args.ctx.runMutation(
            internal.organizationMemories.upsertFromAgent,
            {
              organizationId: args.organizationId,
              agentRunId: args.agentRunId,
              sourceMessageId: args.assistantMessageId,
              key: input.key,
              value: input.value,
              category: input.category,
              importance: input.importance,
              confidence: input.confidence,
            },
          );
          const output = { status: "saved", memoryId };
          await recordTool(args, "remember_organization_context", input, output, startedAt);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Memory save failed";
          await recordTool(args, "remember_organization_context", input, undefined, startedAt, message);
          return { status: "failed", error: message };
        }
      },
    }),
    forget_organization_memory: tool({
      description:
        "Archive an organization memory when the user says it is wrong, stale, or no longer relevant.",
      inputSchema: z.object({
        key: z.string().min(2).max(80),
        reason: z.string().max(500).optional(),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        try {
          const memoryId = await args.ctx.runMutation(
            internal.organizationMemories.archiveFromAgent,
            {
              organizationId: args.organizationId,
              agentRunId: args.agentRunId,
              key: input.key,
              reason: input.reason,
            },
          );
          const output = { status: memoryId ? "archived" : "not_found", memoryId };
          await recordTool(args, "forget_organization_memory", input, output, startedAt);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Memory archive failed";
          await recordTool(args, "forget_organization_memory", input, undefined, startedAt, message);
          return { status: "failed", error: message };
        }
      },
    }),
  };
}

async function recordTool(
  args: {
    ctx: ActionCtx;
    organizationId: Id<"organizations">;
    studyId: Id<"studies">;
    chatSessionId: Id<"chatSessions">;
    agentRunId: Id<"agentRuns">;
  },
  toolName: string,
  input: unknown,
  output: unknown,
  startedAt: number,
  error?: string,
) {
  await args.ctx.runMutation(internal.hermesData.recordToolEvent, {
    organizationId: args.organizationId,
    studyId: args.studyId,
    chatSessionId: args.chatSessionId,
    agentRunId: args.agentRunId,
    toolName,
    status: error ? "failed" : "completed",
    input,
    output,
    error,
    startedAt,
  });
}
