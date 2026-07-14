// Shared helpers for Meridian's Laminar evals.
//
// Both eval suites call the SAME Vercel AI Gateway that the app uses, so we are
// testing the real model behaviour, not a mock. Two things live here:
//   1. callModel()  — send messages to the model and get raw text back.
//   2. llmJudge()   — ask a model a yes/no question about an output and return 1 or 0.
//      (Used for subjective checks like "is this question neutral / non-leading?")

// Load evals/.env (no extra dependency) so LMNR_PROJECT_API_KEY + AI_GATEWAY_API_KEY
// are available regardless of how the eval is launched.
import { readFileSync as _readEnv } from "node:fs";
import { resolve as _resolveEnv } from "node:path";
try {
  const raw = _readEnv(_resolveEnv(process.cwd(), "evals/.env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // no evals/.env yet — rely on the ambient environment
}

const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

// Keep these in sync with the app. Interviewer + strategist use fast models.
export const INTERVIEW_MODEL = "google/gemini-3.1-flash-lite";
export const JUDGE_MODEL = "google/gemini-3.1-flash-lite";

function apiKey(): string {
  const key =
    process.env.AI_GATEWAY_API_KEY ??
    process.env.VERCEL_AI_GATEWAY_API_KEY ??
    process.env.VERCEL_AI_GATEWAY_KEY;
  if (!key) {
    throw new Error(
      "Missing AI_GATEWAY_API_KEY. Set it in evals/.env before running evals.",
    );
  }
  return key;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function callModel(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${AI_GATEWAY_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? INTERVIEW_MODEL,
      messages,
      temperature: opts.temperature ?? 0.4,
    }),
  });
  if (!res.ok) {
    throw new Error(`AI Gateway ${res.status}: ${await res.text()}`);
  }
  const payload = await res.json();
  return String(payload?.choices?.[0]?.message?.content ?? "");
}

// Ask a model to judge a claim about `output`. Returns 1 (passes) or 0 (fails).
// `criterion` should be phrased so that "YES" means the output is GOOD.
export async function llmJudge(
  criterion: string,
  output: string,
): Promise<number> {
  const verdict = await callModel(
    [
      {
        role: "system",
        content:
          "You are a strict evaluator. Answer with a single word: YES or NO. " +
          "YES only if the criterion is fully satisfied. No explanation.",
      },
      {
        role: "user",
        content: `Criterion (YES = good): ${criterion}\n\n---\nOutput to judge:\n${output}\n---\n\nAnswer YES or NO.`,
      },
    ],
    { model: JUDGE_MODEL, temperature: 0 },
  );
  return /^\s*yes/i.test(verdict) ? 1 : 0;
}

// Parse the interviewer's JSON step the same way the app does (strips ``` fences).
export function parseStepLoose(text: string): Record<string, unknown> {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}
