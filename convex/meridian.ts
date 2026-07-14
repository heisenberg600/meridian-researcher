"use node";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { aiSdkTelemetry, Laminar, observe } from "@lmnr-ai/lmnr";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { Bash } from "just-bash";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { buildInitialStudyPrompt } from "./lib/initialStudyPrompt";
import { v } from "convex/values";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const LINKUP_SEARCH_URL = "https://api.linkup.so/v1/search";
const TEXT_FLUSH_INTERVAL_MS = 250;
const WORKSPACE_ROOT = "/workspace";
const SKILLS_ROOT = `${WORKSPACE_ROOT}/.agents/skills`;
const SNAPSHOT_ARCHIVE = "/tmp/meridian-workspace.tgz";
const SANDBOX_COMMAND_TIMEOUT_MS = 20_000;
const SANDBOX_MAX_OUTPUT_CHARS = 30_000;
const SANDBOX_MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;
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

    let sandbox: MeridianSandbox | undefined;
    try {
      const provider = createOpenAICompatible({
        name: "vercel-ai-gateway",
        baseURL: AI_GATEWAY_BASE_URL,
        apiKey,
        includeUsage: true,
      });
      const workspaceSnapshot = await loadWorkspaceSnapshot(ctx, context.run.chatSessionId);
      sandbox = new MeridianSandbox(context.activeSkills, workspaceSnapshot);
      const tools = buildMeridianTools({
        ctx,
        organizationId: context.run.organizationId,
        studyId: context.run.studyId,
        chatSessionId: context.run.chatSessionId,
        agentRunId: args.agentRunId,
        assistantMessageId: args.assistantMessageId,
        sandbox,
      });

      const result = streamText({
        model: provider.languageModel(model),
        instructions: buildSystemInstructions(context),
        messages: buildModelMessages(
          context.messages,
          args.assistantMessageId,
          buildInitialStudyPrompt(context.study),
        ),
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
        } else if (part.type === "error") {
          throw new Error(`AI Gateway stream failed: ${streamErrorMessage(part.error)}`);
        }
      }
      await flushText();

      const usage = await result.usage;
      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;

      await checkpointWorkspace(ctx, {
        sandbox,
        organizationId: context.run.organizationId,
        studyId: context.run.studyId,
        chatSessionId: context.run.chatSessionId,
      });
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
      try {
        if (sandbox) {
          await checkpointWorkspace(ctx, {
            sandbox,
            organizationId: context.run.organizationId,
            studyId: context.run.studyId,
            chatSessionId: context.run.chatSessionId,
          });
        }
      } catch {
        // Preserve the original agent failure; checkpointing is best-effort on failures.
      }
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
  initialPrompt: string,
): ModelMessage[] {
  const modelMessages = messages
    .filter((message) => message._id !== assistantMessageId)
    .filter((message) => message.status === "complete")
    .map((message) => ({
      role: message.role,
      content: message.content ?? textFromParts(message.parts),
    }))
    .filter((message) => message.content.trim().length > 0);

  return modelMessages.length > 0
    ? modelMessages
    : [{ role: "user", content: initialPrompt }];
}

function streamErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "The provider ended the stream with an unknown error.";
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
  activeSkills: Array<{
    name: string;
    description: string;
    content: string;
    version: number;
    scope: string;
  }>;
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
  const skillsCatalog = formatActiveSkills(context.activeSkills);
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
    `Use the sandbox tools for scratch files, calculations, small tables, and user-requested workspace checks. Active skill files are mounted under ${SKILLS_ROOT}. Treat sandbox output as private working context unless the user asks to see it.`,
    "When the user asks to read, inspect, verify, or reuse a workspace file, call sandbox_read_file or sandbox_bash instead of relying on chat history.",
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
    "Active skills:",
    skillsCatalog || "- No active skills were resolved.",
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
  sandbox: MeridianSandbox;
}) {
  return {
    sandbox_bash: tool({
      description:
        "Run a bounded bash command in Meridian's private /workspace sandbox. Use this for scratch notes, calculations, text processing, and creating files. Network access is not available.",
      inputSchema: z.object({
        command: z.string().min(1).max(4000).describe("The bash command to run under /workspace."),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        try {
          const output = await args.sandbox.execute(input.command);
          await recordTool(args, "sandbox_bash", input, output, startedAt);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sandbox command failed";
          await recordTool(args, "sandbox_bash", input, undefined, startedAt, message);
          return { exitCode: 1, stdout: "", stderr: message };
        }
      },
    }),
    sandbox_read_file: tool({
      description:
        "Read a UTF-8 text file from Meridian's private /workspace sandbox after creating it with sandbox_bash.",
      inputSchema: z.object({
        path: z
          .string()
          .min(1)
          .max(500)
          .describe("Workspace-relative path, for example result.txt or notes/summary.md."),
      }),
      execute: async (input) => {
        const startedAt = Date.now();
        try {
          const output = await args.sandbox.readFile(input.path);
          await recordTool(args, "sandbox_read_file", input, output, startedAt);
          return output;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sandbox read failed";
          await recordTool(args, "sandbox_read_file", input, undefined, startedAt, message);
          return { path: input.path, content: "", error: message };
        }
      },
    }),
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

class MeridianSandbox {
  private readonly bash = new Bash({
    cwd: WORKSPACE_ROOT,
    executionLimits: {
      maxCallDepth: 50,
      maxCommandCount: 2_000,
      maxLoopIterations: 2_000,
      maxAwkIterations: 10_000,
      maxSedIterations: 10_000,
      maxJqIterations: 10_000,
      maxOutputSize: SANDBOX_MAX_OUTPUT_CHARS,
    },
  });
  private initialized = false;
  private dirty = false;

  constructor(
    private readonly activeSkills: MeridianRunContext["activeSkills"],
    private readonly snapshot: Uint8Array | null,
  ) {}

  private async ensureInitialized() {
    if (this.initialized) return;
    await this.bash.fs.mkdir(WORKSPACE_ROOT, { recursive: true });
    await this.bash.fs.mkdir("/tmp", { recursive: true });
    if (this.snapshot) {
      await this.bash.fs.writeFile(SNAPSHOT_ARCHIVE, this.snapshot);
      const restored = await this.bash.exec(`tar -xzf ${SNAPSHOT_ARCHIVE} -C ${WORKSPACE_ROOT}`);
      await this.bash.fs.rm(SNAPSHOT_ARCHIVE, { force: true });
      if (restored.exitCode !== 0) {
        throw new Error(`Failed to restore workspace snapshot: ${restored.stderr}`);
      }
    }
    await this.bash.fs.rm(SKILLS_ROOT, { recursive: true, force: true });
    await this.bash.fs.mkdir(SKILLS_ROOT, { recursive: true });
    for (const skill of this.activeSkills) {
      const skillName = normalizeSkillName(skill.name);
      const directory = `${SKILLS_ROOT}/${skillName}`;
      await this.bash.fs.mkdir(directory, { recursive: true });
      await this.bash.fs.writeFile(`${directory}/SKILL.md`, skill.content);
    }
    this.initialized = true;
  }

  async execute(command: string) {
    await this.ensureInitialized();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SANDBOX_COMMAND_TIMEOUT_MS);
    try {
      const result = await this.bash.exec(command, {
        cwd: WORKSPACE_ROOT,
        signal: controller.signal,
      });
      this.dirty = true;
      return {
        exitCode: result.exitCode,
        stdout: truncateSandboxOutput(result.stdout),
        stderr: truncateSandboxOutput(result.stderr),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async readFile(path: string) {
    await this.ensureInitialized();
    const normalizedPath = normalizeWorkspacePath(path);
    const content = await this.bash.fs.readFile(normalizedPath);
    return {
      path: normalizedPath,
      content: truncateSandboxOutput(content),
    };
  }

  async snapshotArchive() {
    await this.ensureInitialized();
    if (!this.dirty) return null;

    await this.bash.fs.mkdir("/tmp", { recursive: true });
    await this.bash.fs.rm(SNAPSHOT_ARCHIVE, { force: true });
    const archived = await this.bash.exec(`tar -czf ${SNAPSHOT_ARCHIVE} .`, {
      cwd: WORKSPACE_ROOT,
    });
    if (archived.exitCode !== 0) {
      throw new Error(`Failed to archive workspace snapshot: ${archived.stderr}`);
    }
    const archive = await this.bash.fs.readFileBuffer(SNAPSHOT_ARCHIVE);
    await this.bash.fs.rm(SNAPSHOT_ARCHIVE, { force: true });
    if (archive.byteLength > SANDBOX_MAX_COMPRESSED_BYTES) {
      throw new Error(
        `Workspace snapshot exceeds ${SANDBOX_MAX_COMPRESSED_BYTES} compressed bytes`,
      );
    }
    this.dirty = false;
    return archive;
  }
}

function normalizeWorkspacePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("\0")) throw new Error("Invalid workspace path");

  const absolutePath = trimmed.startsWith("/") ? trimmed : `${WORKSPACE_ROOT}/${trimmed}`;
  const parts = absolutePath.split("/").filter(Boolean);
  if (parts[0] !== "workspace" || parts.includes("..")) {
    throw new Error("Path must stay inside /workspace");
  }
  return `/${parts.join("/")}`;
}

function normalizeSkillName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
  return normalized;
}

function truncateSandboxOutput(value: string) {
  if (value.length <= SANDBOX_MAX_OUTPUT_CHARS) return value;
  return `${value.slice(0, SANDBOX_MAX_OUTPUT_CHARS)}\n[truncated]`;
}

function formatActiveSkills(skills: MeridianRunContext["activeSkills"]) {
  return skills
    .map(
      (skill) =>
        [
          `<skill name="${escapeXml(skill.name)}" version="${skill.version}" scope="${escapeXml(skill.scope)}">`,
          `<description>${escapeXml(skill.description)}</description>`,
          `<sandboxPath>${SKILLS_ROOT}/${escapeXml(skill.name)}/SKILL.md</sandboxPath>`,
          `<instructions>${escapeXml(skill.content)}</instructions>`,
          "</skill>",
        ].join("\n"),
    )
    .join("\n");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function loadWorkspaceSnapshot(
  ctx: ActionCtx,
  chatSessionId: Id<"chatSessions">,
): Promise<Uint8Array | null> {
  const snapshot = await ctx.runQuery(internal.meridianData.latestWorkspaceSnapshot, {
    chatSessionId,
  });
  if (!snapshot) return null;

  const blob = await ctx.storage.get(snapshot.storageId);
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

async function checkpointWorkspace(
  ctx: ActionCtx,
  args: {
    sandbox: MeridianSandbox;
    organizationId: Id<"organizations">;
    studyId: Id<"studies">;
    chatSessionId: Id<"chatSessions">;
  },
) {
  const archive = await args.sandbox.snapshotArchive();
  if (!archive) return;

  const storageId = await ctx.storage.store(
    new Blob([arrayBufferFromUint8Array(archive)], { type: "application/gzip" }),
  );
  await ctx.runMutation(internal.meridianData.recordWorkspaceSnapshot, {
    organizationId: args.organizationId,
    studyId: args.studyId,
    chatSessionId: args.chatSessionId,
    storageId,
    compressedSizeBytes: archive.byteLength,
  });
}

function arrayBufferFromUint8Array(value: Uint8Array) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
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
  const toolEventId = await startTool(args, toolName, input, startedAt);
  await finishTool(args, toolEventId, output, error);
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
