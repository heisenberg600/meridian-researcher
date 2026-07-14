"use node";

import { createHash } from "node:crypto";
import DodoPayments from "dodopayments";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

type ReceivedEvent = { created: boolean; status: "received" | "processed" | "failed" };

const receiveEventRef = makeFunctionReference<
  "mutation",
  { eventId: string; eventType: string; payloadHash: string },
  ReceivedEvent
>("paymentWebhooks:receiveEvent");
const processVerifiedPaymentRef = makeFunctionReference<
  "mutation",
  {
    eventId: string;
    paymentId: string;
    checkoutSessionId: string;
    productCart: Array<{ productId: string; quantity: number }>;
  },
  { status: "processed" | "duplicate"; creditTransactionId?: Id<"creditTransactions"> }
>("paymentWebhooks:processVerifiedPayment");
const markEventProcessedRef = makeFunctionReference<
  "mutation",
  { eventId: string },
  { status: "processed" }
>("paymentWebhooks:markEventProcessed");
const markEventFailedRef = makeFunctionReference<
  "mutation",
  { eventId: string; error: string },
  { status: string }
>("paymentWebhooks:markEventFailed");

type WebhookClient = Pick<DodoPayments, "webhooks">;

export function unwrapDodoWebhook(
  client: WebhookClient,
  rawBody: string,
  headers: Record<string, string>,
  key: string,
) {
  return client.webhooks.unwrap(rawBody, { headers, key });
}

export const verifyAndProcess = action({
  args: {
    rawBody: v.string(),
    eventId: v.string(),
    signature: v.string(),
    timestamp: v.string(),
  },
  handler: async (ctx, args) => {
  const { rawBody, eventId, signature, timestamp } = args;
  if (!eventId || !signature || !timestamp) {
    return webhookResult(400, "Missing required webhook signature headers");
  }

  let persisted = false;
  try {
    const apiKey = requireEnvironment("DODO_PAYMENTS_API_KEY");
    const key = requireEnvironment("DODO_PAYMENTS_WEBHOOK_KEY");
    const client = new DodoPayments({ bearerToken: apiKey, environment: "test_mode" });
    const headers = {
      "webhook-id": eventId,
      "webhook-signature": signature,
      "webhook-timestamp": timestamp,
    };
    const verified = unwrapDodoWebhook(client, rawBody, headers, key);
    const eventType = verified.type;
    const received = await ctx.runMutation(receiveEventRef, {
      eventId,
      eventType,
      payloadHash: createHash("sha256").update(rawBody).digest("hex"),
    });
    persisted = true;
    if (!received.created && received.status === "processed") {
      return webhookResult(200, "duplicate");
    }
    if (eventType !== "payment.succeeded") {
      await ctx.runMutation(markEventProcessedRef, { eventId });
      return webhookResult(200, "ignored");
    }

    const payment = verified.data;
    if (!payment.checkout_session_id) {
      throw new Error("Successful payment is missing its checkout session ID");
    }
    if (payment.status && payment.status !== "succeeded") {
      throw new Error("Successful payment event contains a non-succeeded payment status");
    }
    const productCart = payment.product_cart?.map((item) => ({
      productId: item.product_id,
      quantity: item.quantity,
    })) ?? [];
    const result = await ctx.runMutation(processVerifiedPaymentRef, {
      eventId,
      paymentId: payment.payment_id,
      checkoutSessionId: payment.checkout_session_id,
      productCart,
    });
    return { status: 200, message: result.status };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Webhook processing failed";
    if (persisted) {
      await ctx.runMutation(markEventFailedRef, { eventId, error: message });
      return webhookResult(500, "Webhook processing failed");
    }
    return webhookResult(400, "Invalid webhook signature or payload");
  }
  },
});

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function webhookResult(status: number, message: string) {
  return { status, message };
}
