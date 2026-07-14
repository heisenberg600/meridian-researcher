"use node";

import { createHash, randomUUID } from "node:crypto";
import DodoPayments from "dodopayments";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import type { TopUpPackKey } from "./payments";

type PersistedCheckout = {
  organizationId: Id<"organizations">;
  checkoutIntentId: string;
  productId: string;
  mode: "test" | "live";
  packKey: string;
  expectedGrant: number;
  status: "creating" | "created" | "paid" | "expired" | "failed";
  dodoSessionId?: string;
  checkoutUrl?: string;
};

const authorizeCheckoutRef = makeFunctionReference<
  "query",
  { organizationId: Id<"organizations"> },
  { authorized: true }
>("payments:authorizeCheckout");
const prepareCheckoutRef = makeFunctionReference<
  "mutation",
  {
    organizationId: Id<"organizations">;
    packKey: TopUpPackKey;
    callerIdempotencyKey: string;
    proposedCheckoutIntentId: string;
    productId: string;
  },
  PersistedCheckout | null
>("payments:prepareCheckout");
const completeCheckoutRef = makeFunctionReference<
  "mutation",
  {
    organizationId: Id<"organizations">;
    checkoutIntentId: string;
    productId: string;
    dodoSessionId: string;
    checkoutUrl: string;
  },
  PersistedCheckout | null
>("payments:completeCheckout");
const failCheckoutRef = makeFunctionReference<
  "mutation",
  { organizationId: Id<"organizations">; checkoutIntentId: string },
  PersistedCheckout | null
>("payments:failCheckout");

export function deriveProviderIdempotencyKey(
  organizationId: string,
  checkoutIntentId: string,
) {
  const digest = createHash("sha256")
    .update(`${organizationId}\u0000${checkoutIntentId}`)
    .digest("hex");
  return `meridian-checkout-${digest}`;
}

export const createTopUpCheckout = action({
  args: {
    organizationId: v.id("organizations"),
    packKey: v.union(
      v.literal("credits_1m"),
      v.literal("credits_3m"),
      v.literal("credits_10m"),
    ),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(authorizeCheckoutRef, { organizationId: args.organizationId });
    if (!args.idempotencyKey.trim()) throw new Error("Checkout idempotency key must not be empty");

    const apiKey = requireEnvironment("DODO_PAYMENTS_API_KEY");
    const returnUrl = requireSecureEnvironmentUrl("DODO_CHECKOUT_RETURN_URL");
    const productId = requireEnvironment(productEnvironmentName(args.packKey));
    const checkout = await ctx.runMutation(prepareCheckoutRef, {
      organizationId: args.organizationId,
      packKey: args.packKey,
      callerIdempotencyKey: args.idempotencyKey,
      proposedCheckoutIntentId: randomUUID(),
      productId,
    });
    if (!checkout) throw new Error("Checkout intent could not be persisted");
    if (checkout.status === "created" || checkout.status === "paid") {
      return checkout;
    }

    const providerIdempotencyKey = deriveProviderIdempotencyKey(
      args.organizationId,
      checkout.checkoutIntentId,
    );
    try {
      const client = new DodoPayments({
        bearerToken: apiKey,
        environment: "test_mode",
      });
      const providerCheckout = await client.checkoutSessions.create(
        {
          product_cart: [{ product_id: productId, quantity: 1 }],
          return_url: returnUrl,
          metadata: { meridian_checkout_intent_id: checkout.checkoutIntentId },
        },
        { idempotencyKey: providerIdempotencyKey },
      );
      if (!providerCheckout.session_id.trim()) {
        throw new Error("Dodo returned an empty checkout session ID");
      }
      if (!providerCheckout.checkout_url) {
        throw new Error("Dodo did not return a hosted checkout URL");
      }
      return await ctx.runMutation(completeCheckoutRef, {
        organizationId: args.organizationId,
        checkoutIntentId: checkout.checkoutIntentId,
        productId,
        dodoSessionId: providerCheckout.session_id,
        checkoutUrl: providerCheckout.checkout_url,
      });
    } catch (cause) {
      await ctx.runMutation(failCheckoutRef, {
        organizationId: args.organizationId,
        checkoutIntentId: checkout.checkoutIntentId,
      });
      throw cause;
    }
  },
});

function productEnvironmentName(packKey: TopUpPackKey) {
  return {
    credits_1m: "DODO_PRODUCT_CREDITS_1M",
    credits_3m: "DODO_PRODUCT_CREDITS_3M",
    credits_10m: "DODO_PRODUCT_CREDITS_10M",
  }[packKey];
}

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function requireSecureEnvironmentUrl(name: string) {
  const value = requireEnvironment(name);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${name} must be a secure HTTPS URL`);
  }
  return value;
}
