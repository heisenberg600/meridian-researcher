export type AIPurpose = "chat" | "interview" | "questionnaire" | "analysis" | "knowledge";

export type NormalizedUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

const models: Record<AIPurpose, string> = {
  chat: "gpt-5-mini",
  interview: "gpt-5-mini",
  questionnaire: "gpt-5-mini",
  analysis: "gpt-5-mini",
  knowledge: "gpt-5-mini",
};

export function getOpenAIModel(purpose: AIPurpose): string {
  return models[purpose];
}

export function requireOpenAIKey(env: Record<string, string | undefined> = process.env): string {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

export function getOpenAIConfig(
  purpose: AIPurpose,
  env: Record<string, string | undefined> = process.env,
) {
  requireOpenAIKey(env);
  return {
    baseURL: "https://api.openai.com/v1",
    model: getOpenAIModel(purpose),
    provider: "openai" as const,
  };
}

export function normalizeOpenAIUsage(value: unknown): NormalizedUsage {
  if (!value || typeof value !== "object") throw new Error("Provider did not return exact usage");
  const usage = value as Record<string, unknown>;
  const fields = {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  };
  for (const [name, count] of Object.entries(fields)) {
    if (!Number.isSafeInteger(count) || Number(count) < 0) {
      throw new Error(`Provider did not return exact ${name}`);
    }
  }
  if (Number(fields.total_tokens) < Number(fields.prompt_tokens) + Number(fields.completion_tokens)) {
    throw new Error("Provider total_tokens cannot be lower than prompt and completion tokens");
  }
  return {
    inputTokens: Number(fields.prompt_tokens),
    outputTokens: Number(fields.completion_tokens),
    totalTokens: Number(fields.total_tokens),
  };
}

export function normalizeAISDKUsage(value: unknown): NormalizedUsage {
  if (!value || typeof value !== "object") throw new Error("Provider did not return exact usage");
  const usage = value as Record<string, unknown>;
  return normalizeOpenAIUsage({ prompt_tokens: usage.inputTokens, completion_tokens: usage.outputTokens, total_tokens: usage.totalTokens });
}

export async function runCreditSafeProviderOperation<T>(dependencies: {
  reserve: () => Promise<string>;
  execute: () => Promise<{ value: T; providerOperationId: string; usage: unknown }>;
  settle: (reservationId: string, result: { providerOperationId: string; usage: NormalizedUsage }) => Promise<void>;
  release: (reservationId: string) => Promise<void>;
}): Promise<{ value: T; providerOperationId: string; usage: NormalizedUsage }> {
  let reservationId: string | undefined;
  try {
    reservationId = await dependencies.reserve();
    const result = await dependencies.execute();
    const usage = normalizeOpenAIUsage(result.usage);
    await dependencies.settle(reservationId, { providerOperationId: result.providerOperationId, usage });
    return { value: result.value, providerOperationId: result.providerOperationId, usage };
  } catch (error) {
    if (reservationId) await dependencies.release(reservationId).catch(() => undefined);
    throw error;
  }
}

export function safeProviderError(error: unknown, secrets: Array<string | undefined> = []): string {
  const message = error instanceof Error ? error.message : "The AI provider request failed.";
  if (secrets.some((secret) => secret && message.includes(secret))) {
    return "The AI provider request failed. Please retry.";
  }
  return message.slice(0, 300);
}
