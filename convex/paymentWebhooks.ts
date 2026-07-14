import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ACTIVE_RATE_CARD_VERSION, assertWholeCredits } from "./lib/billing";

export type DodoWebhookHeaders = {
  "webhook-id": string;
  "webhook-signature": string;
  "webhook-timestamp": string;
};

export type VerifiedDodoWebhookEvent = {
  eventId: string;
  eventType: string;
  paymentId?: string;
  checkoutSessionId?: string;
  checkoutIntentId?: string;
  organizationId?: string;
};

export interface RawWebhookVerifier {
  verify(
    rawBody: string,
    headers: DodoWebhookHeaders,
  ): Promise<VerifiedDodoWebhookEvent>;
}

export type PaymentWebhookEvent = {
  eventId: string;
  eventType: string;
  payloadHash: string;
  status: "received" | "processed" | "failed";
  error?: string;
  receivedAt: number;
  processedAt?: number;
};

export interface WebhookEventStore {
  receive(event: Omit<PaymentWebhookEvent, "status" | "receivedAt">): Promise<{
    created: boolean;
    event: PaymentWebhookEvent;
  }>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, error: string): Promise<void>;
  get(eventId: string): Promise<PaymentWebhookEvent | undefined>;
}

export class MemoryWebhookEventStore implements WebhookEventStore {
  private readonly events = new Map<string, PaymentWebhookEvent>();

  constructor(
    private readonly now: () => number = Date.now,
  ) {}

  async receive(event: Omit<PaymentWebhookEvent, "status" | "receivedAt">) {
    const existing = this.events.get(event.eventId);
    if (existing) {
      if (
        existing.eventType !== event.eventType ||
        existing.payloadHash !== event.payloadHash
      ) {
        throw new Error("Webhook event ID was reused with a different payload");
      }
      return { created: false, event: existing };
    }
    const received: PaymentWebhookEvent = {
      ...event,
      status: "received",
      receivedAt: this.now(),
    };
    this.events.set(event.eventId, received);
    return { created: true, event: received };
  }

  async markProcessed(eventId: string) {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Webhook event was not received");
    event.status = "processed";
    event.error = undefined;
    event.processedAt = this.now();
  }

  async markFailed(eventId: string, error: string) {
    const event = this.events.get(eventId);
    if (!event) throw new Error("Webhook event was not received");
    if (event.status === "processed") return;
    event.status = "failed";
    event.error = error;
  }

  async get(eventId: string) {
    return this.events.get(eventId);
  }
}

type WebhookPaymentsService = {
  markCheckoutPaidFromWebhook(args: {
    organizationId: string;
    checkoutIntentId: string;
    dodoSessionId: string;
    dodoPaymentId: string;
  }): Promise<{
    created: boolean;
    checkout: { expectedGrant: number };
  }>;
};

type WebhookCreditsService = {
  grantCredits(args: {
    organizationId: string;
    amount: number;
    idempotencyKey: string;
    rateCardVersion?: string;
  }): Promise<unknown>;
};

export async function processDodoWebhook(
  request: { rawBody: string; headers: DodoWebhookHeaders },
  dependencies: {
    verifier: RawWebhookVerifier;
    eventStore: WebhookEventStore;
    payments: WebhookPaymentsService;
    credits: WebhookCreditsService;
  },
) {
  const verified = await dependencies.verifier.verify(request.rawBody, request.headers);
  if (verified.eventId !== request.headers["webhook-id"]) {
    throw new Error("Verified webhook ID does not match the signed webhook header");
  }

  const received = await dependencies.eventStore.receive({
    eventId: verified.eventId,
    eventType: verified.eventType,
    payloadHash: await sha256Hex(request.rawBody),
  });
  if (!received.created && received.event.status === "processed") {
    return { status: "duplicate" as const };
  }

  try {
    if (verified.eventType !== "payment.succeeded") {
      await dependencies.eventStore.markProcessed(verified.eventId);
      return { status: "ignored" as const };
    }

    const payment = requireSuccessfulPayment(verified);
    const paid = await dependencies.payments.markCheckoutPaidFromWebhook({
      organizationId: payment.organizationId,
      checkoutIntentId: payment.checkoutIntentId,
      dodoSessionId: payment.checkoutSessionId,
      dodoPaymentId: payment.paymentId,
    });
    await dependencies.credits.grantCredits({
      organizationId: payment.organizationId,
      amount: paid.checkout.expectedGrant,
      idempotencyKey: `dodo-payment:${payment.paymentId}`,
      rateCardVersion: ACTIVE_RATE_CARD_VERSION,
    });
    await dependencies.eventStore.markProcessed(verified.eventId);
    return { status: "processed" as const };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Webhook processing failed";
    await dependencies.eventStore.markFailed(verified.eventId, message);
    throw cause;
  }
}

type PersistedCheckoutForPayment = {
  organizationId: string;
  dodoSessionId?: string;
  productId: string;
  mode: "test" | "live";
  expectedGrant: number;
  status: "creating" | "created" | "paid" | "expired" | "failed";
};

type VerifiedPaymentForCheckout = {
  paymentId: string;
  checkoutSessionId: string;
  productCart: Array<{ productId: string; quantity: number }>;
};

export function validatePersistedPayment(
  checkout: PersistedCheckoutForPayment,
  payment: VerifiedPaymentForCheckout,
  requiredMode: "test" | "live",
) {
  if (!checkout.dodoSessionId || checkout.dodoSessionId !== payment.checkoutSessionId) {
    throw new Error("Payment checkout session does not match the persisted checkout");
  }
  if (checkout.mode !== requiredMode) {
    throw new Error(`Payment checkout mode does not match required ${requiredMode} mode`);
  }
  if (
    payment.productCart.length !== 1 ||
    payment.productCart[0]?.productId !== checkout.productId ||
    payment.productCart[0]?.quantity !== 1
  ) {
    throw new Error("Payment product cart does not match the persisted checkout product");
  }
  assertWholeCredits(checkout.expectedGrant, "expected credit grant");
  return {
    organizationId: checkout.organizationId,
    expectedGrant: checkout.expectedGrant,
  };
}

export const receiveEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
  },
  handler: async (ctx, args) => {
    assertNonEmpty(args.eventId, "Dodo event ID");
    assertNonEmpty(args.eventType, "Dodo event type");
    assertNonEmpty(args.payloadHash, "webhook payload hash");
    const existing = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_dodo_event", (q) => q.eq("dodoEventId", args.eventId))
      .unique();
    if (existing) {
      if (existing.eventType !== args.eventType || existing.payloadHash !== args.payloadHash) {
        throw new Error("Webhook event ID was reused with a different payload");
      }
      return { created: false, status: existing.status };
    }
    await ctx.db.insert("paymentWebhookEvents", {
      dodoEventId: args.eventId,
      eventType: args.eventType,
      payloadHash: args.payloadHash,
      status: "received",
      createdAt: Date.now(),
    });
    return { created: true, status: "received" as const };
  },
});

export const processVerifiedPayment = internalMutation({
  args: {
    eventId: v.string(),
    paymentId: v.string(),
    checkoutSessionId: v.string(),
    productCart: v.array(v.object({ productId: v.string(), quantity: v.number() })),
  },
  handler: async (ctx, args) => {
    assertNonEmpty(args.paymentId, "Dodo payment ID");
    assertNonEmpty(args.checkoutSessionId, "Dodo checkout session ID");
    const event = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_dodo_event", (q) => q.eq("dodoEventId", args.eventId))
      .unique();
    if (!event) throw new Error("Webhook event was not received");
    if (event.status === "processed") return { status: "duplicate" as const };
    if (event.paymentId && event.paymentId !== args.paymentId) {
      throw new Error("Webhook event was already attached to a different payment");
    }

    const checkout = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_dodo_session", (q) => q.eq("dodoSessionId", args.checkoutSessionId))
      .unique();
    if (!checkout) throw new Error("Persisted checkout session not found");
    const validated = validatePersistedPayment(checkout, args, "test");
    const existingGrant = await ctx.db
      .query("creditTransactions")
      .withIndex("by_provider_payment", (q) => q.eq("providerPaymentId", args.paymentId))
      .unique();
    if (existingGrant) {
      if (
        existingGrant.organizationId !== checkout.organizationId ||
        existingGrant.type !== "grant" ||
        existingGrant.amount !== validated.expectedGrant ||
        checkout.status !== "paid" ||
        checkout.dodoPaymentId !== args.paymentId
      ) {
        throw new Error("Dodo payment ID was already used by a different credit grant");
      }
      const timestamp = Date.now();
      await ctx.db.patch(event._id, {
        organizationId: checkout.organizationId,
        paymentId: args.paymentId,
        checkoutSessionId: args.checkoutSessionId,
        status: "processed",
        error: undefined,
        processedAt: timestamp,
      });
      return { status: "duplicate" as const };
    }
    if (checkout.status === "paid") {
      throw new Error("Paid checkout is missing its durable credit grant");
    }
    if (checkout.status !== "created") {
      throw new Error(`Cannot grant credits for a ${checkout.status} checkout`);
    }

    const wallet = await ctx.db
      .query("creditWallets")
      .withIndex("by_organization", (q) => q.eq("organizationId", checkout.organizationId))
      .unique();
    if (!wallet) throw new Error("Credit wallet has not been provisioned");
    validateWallet(wallet);
    const granted = safeAdd(wallet.granted, validated.expectedGrant);
    const available = safeAdd(wallet.available, validated.expectedGrant);
    const timestamp = Date.now();
    await ctx.db.patch(wallet._id, { granted, available, updatedAt: timestamp });
    const creditTransactionId = await ctx.db.insert("creditTransactions", {
      organizationId: checkout.organizationId,
      type: "grant",
      amount: validated.expectedGrant,
      balanceAfter: available,
      idempotencyKey: `dodo-payment:${args.paymentId}`,
      rateCardVersion: ACTIVE_RATE_CARD_VERSION,
      reason: "dodo_top_up",
      providerPaymentId: args.paymentId,
      createdAt: timestamp,
    });
    await ctx.db.patch(checkout._id, {
      status: "paid",
      dodoPaymentId: args.paymentId,
      updatedAt: timestamp,
    });
    await ctx.db.patch(event._id, {
      organizationId: checkout.organizationId,
      paymentId: args.paymentId,
      checkoutSessionId: args.checkoutSessionId,
      status: "processed",
      error: undefined,
      processedAt: timestamp,
    });
    return { status: "processed" as const, creditTransactionId };
  },
});

export const markEventProcessed = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_dodo_event", (q) => q.eq("dodoEventId", args.eventId))
      .unique();
    if (!event) throw new Error("Webhook event was not received");
    if (event.status !== "processed") {
      await ctx.db.patch(event._id, {
        status: "processed",
        error: undefined,
        processedAt: Date.now(),
      });
    }
    return { status: "processed" as const };
  },
});

export const markEventFailed = internalMutation({
  args: { eventId: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_dodo_event", (q) => q.eq("dodoEventId", args.eventId))
      .unique();
    if (!event || event.status === "processed") return { status: event?.status ?? "missing" };
    await ctx.db.patch(event._id, {
      status: "failed",
      error: args.error.slice(0, 500),
    });
    return { status: "failed" as const };
  },
});

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateWallet(wallet: {
  granted: number;
  available: number;
  reserved: number;
  consumed: number;
}) {
  assertWholeCredits(wallet.granted, "wallet granted", true);
  assertWholeCredits(wallet.available, "wallet available", true);
  assertWholeCredits(wallet.reserved, "wallet reserved", true);
  assertWholeCredits(wallet.consumed, "wallet consumed", true);
}

function safeAdd(left: number, right: number) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error("Credit balance exceeds safe integer range");
  return result;
}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} must not be empty`);
}

function requireSuccessfulPayment(event: VerifiedDodoWebhookEvent) {
  if (
    !event.paymentId ||
    !event.checkoutSessionId ||
    !event.checkoutIntentId ||
    !event.organizationId
  ) {
    throw new Error("Verified payment webhook is missing Meridian checkout identifiers");
  }
  return {
    paymentId: event.paymentId,
    checkoutSessionId: event.checkoutSessionId,
    checkoutIntentId: event.checkoutIntentId,
    organizationId: event.organizationId,
  };
}
