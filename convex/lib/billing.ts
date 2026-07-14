export type BillableOperation =
  | "ai_chat"
  | "source_processing"
  | "email_delivery"
  | "connected_voice"
  | "analysis"
  | "report_generation"
  | "image_generation";

export type BillableCharge = {
  operation: BillableOperation;
  nativeQuantity: number;
  nativeUnit: string;
  credits: number;
  rateCardVersion: string;
};

export const ACTIVE_RATE_CARD_VERSION = "2026-07-14.poc-v1";

export type RateCardEntry = {
  operation: BillableOperation;
  nativeUnit: string;
  nativeUnitsPerBlock: number;
  creditsPerBlock: number;
};

export const RATE_CARDS: Readonly<Record<string, readonly RateCardEntry[]>> = {
  [ACTIVE_RATE_CARD_VERSION]: [
    { operation: "ai_chat", nativeUnit: "token", nativeUnitsPerBlock: 1_000, creditsPerBlock: 1 },
    { operation: "source_processing", nativeUnit: "source", nativeUnitsPerBlock: 1, creditsPerBlock: 100 },
    { operation: "email_delivery", nativeUnit: "accepted_email", nativeUnitsPerBlock: 1, creditsPerBlock: 2 },
    { operation: "connected_voice", nativeUnit: "connected_second", nativeUnitsPerBlock: 60, creditsPerBlock: 1_200 },
    { operation: "analysis", nativeUnit: "token", nativeUnitsPerBlock: 1_000, creditsPerBlock: 5 },
    { operation: "report_generation", nativeUnit: "report", nativeUnitsPerBlock: 1, creditsPerBlock: 500 },
    { operation: "image_generation", nativeUnit: "image", nativeUnitsPerBlock: 1, creditsPerBlock: 1_000 },
  ],
};

export function calculateBillableCredits(args: {
  operation: BillableOperation;
  nativeQuantity: number;
  rateCardVersion?: string;
}): BillableCharge {
  assertWholeCredits(args.nativeQuantity, "nativeQuantity", true);
  const rateCardVersion = args.rateCardVersion ?? ACTIVE_RATE_CARD_VERSION;
  const rate = RATE_CARDS[rateCardVersion]?.find((entry) => entry.operation === args.operation);
  if (!rate) throw new Error(`No rate configured for ${args.operation} on ${rateCardVersion}`);

  const credits = Math.ceil(args.nativeQuantity / rate.nativeUnitsPerBlock) * rate.creditsPerBlock;
  assertWholeCredits(credits, "calculated credits", true);
  return {
    operation: args.operation,
    nativeQuantity: args.nativeQuantity,
    nativeUnit: rate.nativeUnit,
    credits,
    rateCardVersion,
  };
}

export function assertWholeCredits(value: number, name = "credits", allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${name} must be a safe non-negative integer${allowZero ? "" : " greater than zero"}`);
  }
}
