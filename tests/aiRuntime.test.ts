import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  getOpenAIConfig,
  normalizeOpenAIUsage,
  runCreditSafeProviderOperation,
  safeProviderError,
} from "../convex/lib/ai";

test("active AI configuration requires only OPENAI_API_KEY and never returns the secret", () => {
  const config = getOpenAIConfig("analysis", { OPENAI_API_KEY: "sk-test-secret" });
  assert.deepEqual(config, {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    provider: "openai",
  });
  assert.doesNotMatch(JSON.stringify(config), /sk-test-secret/);
  assert.throws(() => getOpenAIConfig("analysis", { AI_GATEWAY_API_KEY: "legacy" }), /OPENAI_API_KEY/);
});

test("OpenAI usage normalization requires exact non-negative token counts", () => {
  assert.deepEqual(normalizeOpenAIUsage({ prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 }), {
    inputTokens: 12,
    outputTokens: 7,
    totalTokens: 19,
  });
  assert.throws(() => normalizeOpenAIUsage({ prompt_tokens: 12, completion_tokens: 7 }), /exact total_tokens/);
  assert.throws(() => normalizeOpenAIUsage({ prompt_tokens: 12, completion_tokens: -1, total_tokens: 11 }), /exact completion_tokens/);
});

test("credit-safe provider execution settles exact usage and releases failed reservations", async () => {
  const events: string[] = [];
  const success = await runCreditSafeProviderOperation({
    reserve: async () => { events.push("reserve"); return "reservation-1"; },
    execute: async () => ({ value: "ok", providerOperationId: "response-1", usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } }),
    settle: async (_reservationId, result) => { events.push(`settle:${result.usage.totalTokens}`); },
    release: async () => { events.push("release"); },
  });
  assert.equal(success.value, "ok");
  assert.deepEqual(events, ["reserve", "settle:8"]);

  await assert.rejects(() => runCreditSafeProviderOperation({
    reserve: async () => "reservation-2",
    execute: async () => { throw new Error("provider failed with sk-private"); },
    settle: async () => undefined,
    release: async () => { events.push("released-failure"); },
  }), /provider failed/);
  assert.equal(events.at(-1), "released-failure");
  assert.equal(safeProviderError(new Error("request sk-private failed"), ["sk-private"]), "The AI provider request failed. Please retry.");
});

test("active production AI paths contain no Gemini or Vercel gateway defaults", async () => {
  const files = ["meridian.ts", "interviewBriefs.ts", "interviews.ts", "analysisActions.ts"];
  for (const file of files) {
    const source = await readFile(new URL(`../convex/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /AI_GATEWAY|VERCEL_AI|gemini|ai-gateway\.vercel/i, file);
    assert.match(source, /OPENAI_API_KEY|requireOpenAIKey|getOpenAIConfig/, file);
  }
});
