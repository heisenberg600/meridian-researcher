"use node";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { aiSdkTelemetry, Laminar, observe } from "@lmnr-ai/lmnr";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const LINKUP_SEARCH_URL = "https://api.linkup.so/v1/search";
const TEXT_FLUSH_INTERVAL_MS = 250;
let laminarInitialized = false;

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
  handler: runProcessMessage,
});

type ProcessMessageArgs = {
  agentRunId: Id<"agentRuns">;
  assistantMessageId: Id<"messages">;
};

async function runProcessMessage(ctx: ActionCtx, args: ProcessMessageArgs): Promise<void> {
  const projectApiKey = process.env.LMNR_PROJECT_API_KEY;
  if (!projectApiKey) return executeMeridianRun(ctx, args, false);

  if (!laminarInitialized) {
    Laminar.initialize({
      projectApiKey,
      instrumentModules: {},
      forceHttp: true,
    });
    laminarInitialized = true;
  }

  const context: MeridianRunContext = await ctx.runQuery(internal.meridianData.getRunContext, {
    agentRunId: args.agentRunId,
  });

  try {
    return await observe(
      {
        name: "meridian.agent.run",
        input: {
          agentRunId: args.agentRunId,
          assistantMessageId: args.assistantMessageId,
        },
        sessionId: context.chatSession._id,
        userId: context.run.startedBy,
        metadata: {
          organizationId: context.run.organizationId,
          studyId: context.run.studyId,
          chatSessionId: context.run.chatSessionId,
          agentRunId: args.agentRunId,
          studyStatus: context.study.status,
          activeSkillNames: context.run.activeSkillNames,
        },
        tags: ["meridian", "agent-run", context.study.status],
      },
      async () => {
        const traceId = Laminar.getTraceId();
        if (traceId) {
          await ctx.runMutation(internal.meridianData.setRunTrace, {
            agentRunId: args.agentRunId,
            laminarTraceId: traceId,
          });
        }
        return executeMeridianRun(ctx, args, true);
      },
    );
  } finally {
    await Laminar.flush();
  }
}

async function executeMeridianRun(
  ctx: ActionCtx,
  args: ProcessMessageArgs,
  tracingEnabled: boolean,
): Promise<void> {
    const context: MeridianRunContext = await ctx.runQuery(internal.meridianData.getRunContext, {
      agentRunId: args.agentRunId,
    });
    const model =
      process.env.AI_GATEWAY_MODEL ??
      process.env.MERIDIAN_MODEL ??
      DEFAULT_MODEL;
    const apiKey =
      process.env.AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_KEY;

    if (tracingEnabled) {
      Laminar.setTraceMetadata({ model });
    }

    await ctx.runMutation(internal.meridianData.setRunRunning, {
      agentRunId: args.agentRunId,
      model,
    });

    if (!apiKey) {
      const text = [
        "Meridian is wired to the backend, but the AI Gateway key is not configured yet.",
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
      await ctx.runMutation(internal.meridianData.completeRun, {
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
      const tools = buildMeridianTools({
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
        experimental_telemetry: tracingEnabled
          ? {
              isEnabled: true,
              functionId: "meridian.chat",
              integrations: aiSdkTelemetry(),
            }
          : undefined,
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
      await ctx.runMutation(internal.meridianData.recordUsage, {
        organizationId: context.run.organizationId,
        studyId: context.run.studyId,
        agentRunId: args.agentRunId,
        operation: "meridian.chat",
        model,
        inputTokens,
        outputTokens,
        totalTokens,
      });
      await ctx.runMutation(internal.meridianData.completeRun, {
        agentRunId: args.agentRunId,
        chatSessionId: context.chatSession._id,
      });
      if (tracingEnabled) {
        Laminar.setSpanOutput({
          status: "completed",
          assistantMessageId: args.assistantMessageId,
          usage: { inputTokens, outputTokens, totalTokens },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Meridian failed to respond.";
      await ctx.runMutation(internal.messages.finalizeAssistantMessage, {
        messageId: args.assistantMessageId,
        status: "error",
        errorText: `Meridian could not complete this response. ${message}`,
      });
      await ctx.runMutation(internal.meridianData.failRun, {
        agentRunId: args.agentRunId,
        chatSessionId: context.chatSession._id,
        error: message,
      });
      if (tracingEnabled) {
        Laminar.setSpanOutput({ status: "failed", error: message });
      }
    }
}

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

type MeridianRunContext = {
  run: Doc<"agentRuns">;
  study: Doc<"studies">;
  chatSession: Doc<"chatSessions">;
  messages: Doc<"messages">[];
  memories: Doc<"organizationMemories">[];
  currentPlan: Doc<"studyPlanVersions"> | null;
};

function buildSystemInstructions(context: MeridianRunContext) {
  const memories = context.memories
    .map(
      (memory) =>
        `- [${memory.category}] ${memory.key}: ${memory.value} (confidence ${memory.confidence})`,
    )
    .join("\n");
  const completedUserMessageCount = context.messages.filter(
    (message) => message.role === "user" && message.status === "complete",
  ).length;
  const isInitialStudyIntake = completedUserMessageCount === 0;
  const currentPlan = context.currentPlan
    ? [
        `Current Study Plan: version ${context.currentPlan.version} (${context.currentPlan.status})`,
        context.currentPlan.markdown,
      ].join("\n")
    : "Current Study Plan: No plan has been created yet.";

  return [
    "You are Meridian, a supervised AI product and market research agent.",
    "The user experiences one agent. Internally, behave as a research strategist while the study is in draft.",
    "Your current objective is to help the user create, read, and revise a canonical Study Plan.",
    "The complete Study Plan belongs in the Plan tab, never inline in chat. Use update_study_plan to create or revise it, then give only a concise summary of what changed and any remaining questions.",
    "When the user asks about the existing plan, answer from the Current Study Plan context and direct them to the Plan tab. Do not create a new version unless they request or provide a meaningful change.",
    "The Study Plan must use clear Markdown headings and include: Decision & Context, Research Goal, Hypotheses, Learning Objectives, Target Respondents, Method & Sample, Screener Criteria, Discussion Guide Outline, Evidence & Synthesis Standards, Constraints & Risks, Execution Plan, Open Questions, and Approval Checklist.",
    "Mark unknown information explicitly as an assumption, open question, or TBD. Never invent study constraints or respondent facts.",
    "Ask concise probing questions that close the highest-risk gaps before drafting the study document.",
    "Keep facts, assumptions, hypotheses, findings, and recommendations distinct.",
    "Do not claim fieldwork has happened unless evidence exists.",
    "Do not contact participants or imply outreach has started.",
    "Do not mark the Study Plan ready for review until the user's goal, audience, decision stakes, and material constraints are clear enough. A partial draft may be saved earlier when it helps the user inspect progress.",
    isInitialStudyIntake
      ? "This is the first assistant turn for a newly created study. Open with one short acknowledgement of the business decision, then ask 4-6 prioritized probing questions. Group them for easy answering. Do not mention implementation details or tools."
      : "If enough context is available, update the Study Plan with update_study_plan. Otherwise ask the next few highest-value questions. If a partial plan already exists, keep it synchronized when the user supplies meaningful corrections or additions.",
    "",
    "Organization memories:",
    memories || "- No active organization memories yet.",
    "",
    "Memory tool rules:",
    "Use remember_organization_context only for durable organization-level facts, preferences, constraints, product context, customer context, or research standards that will help future studies.",
    "Do not store secrets, credentials, health data, payment data, or incidental one-off chat details.",
    "Use forget_organization_memory when the user corrects or invalidates a prior memory.",
    "",
    currentPlan,
    "",
    `Study title: ${context.study.title}`,
    `Business decision: ${context.study.businessDecision}`,
    `Study status: ${context.study.status}`,
  ].join("\n");
}

function buildMeridianTools(args: {
  ctx: ActionCtx;
  organizationId: Id<"organizations">;
  studyId: Id<"studies">;
  chatSessionId: Id<"chatSessions">;
  agentRunId: Id<"agentRuns">;
  assistantMessageId: Id<"messages">;
}) {
  return {
    web_search: tool({
      description:
        "Search the public web with Linkup for current company, product, customer, competitor, market, or research context. Returns source titles, URLs, and excerpts that must be cited in the response.",
      inputSchema: z.object({
        query: z.string().min(3).max(1000).describe("A clear, context-rich natural language search query."),
        depth: z
          .enum(["fast", "standard", "deep"])
          .default("standard")
          .describe("Use fast for simple lookups, standard normally, and deep for complex multi-source research."),
        includeDomains: z.array(z.string().min(1)).max(20).optional(),
        excludeDomains: z.array(z.string().min(1)).max(20).optional(),
        maxResults: z.number().int().min(1).max(10).default(5),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        const toolEventId = await startTool(args, "web_search", input, startedAt);
        try {
          const apiKey = process.env.LINKUP_API_KEY;
          if (!apiKey) throw new Error("LINKUP_API_KEY is not configured in Convex");

          const response = await fetch(LINKUP_SEARCH_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: input.query,
              depth: input.depth,
              outputType: "searchResults",
              includeDomains: input.includeDomains,
              excludeDomains: input.excludeDomains,
              maxResults: input.maxResults,
              includeImages: false,
            }),
          });

          if (!response.ok) {
            const detail = (await response.text()).slice(0, 500);
            throw new Error(`Linkup search failed (${response.status}): ${detail}`);
          }

          const payload = (await response.json()) as {
            results?: Array<{ name?: string; url?: string; content?: string; type?: string }>;
          };
          const output = {
            query: input.query,
            results: (payload.results ?? [])
              .filter((result) => result.type !== "image" && result.url)
              .slice(0, input.maxResults)
              .map((result) => ({
                title: result.name ?? "Untitled source",
                url: result.url,
                excerpt: (result.content ?? "").slice(0, 4000),
              })),
          };
          await finishTool(args, toolEventId, output);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Linkup search failed";
          await finishTool(args, toolEventId, undefined, message);
          return { query: input.query, results: [], error: message };
        }
      },
    }),
    remember_organization_context: tool({
      description:
        "Save or update a durable organization memory that should help Meridian in future studies. Use only for stable facts, preferences, constraints, or research standards explicitly implied by the user.",
      inputSchema: z.object({
        key: z.string().min(2).max(80).describe("Stable snake_case key for the memory."),
        value: z.string().min(3).max(1000).describe("The memory text to preserve."),
        category: memoryCategorySchema,
        importance: z.number().min(0).max(1).describe("How useful this is likely to be later."),
        confidence: z.number().min(0).max(1).describe("How confident Meridian is that this memory is true."),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        const toolEventId = await startTool(
          args,
          "remember_organization_context",
          input,
          startedAt,
        );
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
          await finishTool(args, toolEventId, output);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Memory save failed";
          await finishTool(args, toolEventId, undefined, message);
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
        const toolEventId = await startTool(
          args,
          "forget_organization_memory",
          input,
          startedAt,
        );
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
          await finishTool(args, toolEventId, output);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Memory archive failed";
          await finishTool(args, toolEventId, undefined, message);
          return { status: "failed", error: message };
        }
      },
    }),
    update_study_plan: tool({
      description:
        "Create or revise the canonical Study Plan shown in the Plan tab. Always provide the complete plan Markdown, preserving still-valid information from the current version. Use draft while material questions remain and ready_for_review only when the plan is approvable.",
      inputSchema: z.object({
        markdown: z.string().min(200).max(50_000),
        readiness: z.enum(["draft", "ready_for_review"]),
        changeSummary: z
          .string()
          .min(5)
          .max(500)
          .describe("A concise user-facing summary of what changed in this version."),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        const toolEventId = await startTool(args, "update_study_plan", input, startedAt);
        try {
          const output = await args.ctx.runMutation(internal.studyPlans.saveFromAgent, {
            agentRunId: args.agentRunId,
            markdown: input.markdown,
            readiness: input.readiness,
            changeSummary: input.changeSummary,
          });
          await finishTool(args, toolEventId, output);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Study Plan update failed";
          await finishTool(args, toolEventId, undefined, message);
          return { status: "failed", error: message };
        }
      },
    }),
  };
}

async function startTool(
  args: {
    ctx: ActionCtx;
    organizationId: Id<"organizations">;
    studyId: Id<"studies">;
    chatSessionId: Id<"chatSessions">;
    agentRunId: Id<"agentRuns">;
  },
  toolName: string,
  input: unknown,
  startedAt: number,
): Promise<Id<"agentToolEvents"> | null> {
  try {
    return await args.ctx.runMutation(internal.meridianData.startToolEvent, {
      organizationId: args.organizationId,
      studyId: args.studyId,
      chatSessionId: args.chatSessionId,
      agentRunId: args.agentRunId,
      toolName,
      input,
      startedAt,
    });
  } catch {
    return null;
  }
}

async function finishTool(
  args: { ctx: ActionCtx },
  toolEventId: Id<"agentToolEvents"> | null,
  output: unknown,
  error?: string,
) {
  if (!toolEventId) return;
  try {
    await args.ctx.runMutation(internal.meridianData.finishToolEvent, {
      toolEventId,
      status: error ? "failed" : "completed",
      output,
      error,
    });
  } catch {
    // Observability must not interrupt the agent's work.
  }
}
