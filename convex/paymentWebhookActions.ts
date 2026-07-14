"use node";

import { createHash } from "node:crypto";
import DodoPayments from "dodopayments";
import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";

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

export const dodoWebhook = httpAction(async (ctx, request) => {
  const rawBody = await request.text();
  const eventId = request.headers.get("webhook-id")?.trim();
  const signature = request.headers.get("webhook-signature")?.trim();
  const timestamp = request.headers.get("webhook-timestamp")?.trim();
  if (!eventId || !signature || !timestamp) {
    return response(400, "Missing required webhook signature headers");
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
      return response(200, "duplicate");
    }
    if (eventType !== "payment.succeeded") {
      await ctx.runMutation(markEventProcessedRef, { eventId });
      return response(200, "ignored");
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
    return response(200, result.status);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Webhook processing failed";
    if (persisted) {
      await ctx.runMutation(markEventFailedRef, { eventId, error: message });
      return response(500, "Webhook processing failed");
    }
    return response(400, "Invalid webhook signature or payload");
  }
});

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function response(status: number, message: string) {
  return new Response(JSON.stringify({ status: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
