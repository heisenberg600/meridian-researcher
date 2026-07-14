"use node";

import { createHash } from "node:crypto";

import { ACTIVE_RATE_CARD_VERSION } from "./lib/billing";

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
    payloadHash: createHash("sha256").update(request.rawBody).digest("hex"),
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
