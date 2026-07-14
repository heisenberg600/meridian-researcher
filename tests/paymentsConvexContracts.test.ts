import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const paymentsUrl = new URL("../convex/payments.ts", import.meta.url);
const actionsUrl = new URL("../convex/paymentActions.ts", import.meta.url);
const envUrl = new URL("../.env.example", import.meta.url);

test("checkout persistence exposes authorized query and internal recovery mutations", async () => {
  const source = await readFile(paymentsUrl, "utf8");

  assert.match(source, /export const authorizeCheckout = query\(/);
  assert.match(source, /export const getCheckout = query\(/);
  assert.match(source, /export const prepareCheckout = internalMutation\(/);
  assert.match(source, /export const completeCheckout = internalMutation\(/);
  assert.match(source, /export const failCheckout = internalMutation\(/);
  assert.ok(
    (source.match(/requireOrganizationAccess\(ctx, args\.organizationId\)/g)?.length ?? 0) >= 2,
  );
});

test("checkout action uses the official Dodo SDK in Test Mode with a server-derived key", async () => {
  const source = await readFile(actionsUrl, "utf8").catch(() => "");

  assert.match(source, /import DodoPayments from "dodopayments"/);
  assert.match(source, /environment: "test_mode"/);
  assert.doesNotMatch(source, /environment: "live_mode"/);
  assert.match(source, /export function deriveProviderIdempotencyKey/);
  assert.match(source, /idempotencyKey: providerIdempotencyKey/);
  assert.match(source, /product_cart: \[\{ product_id: productId, quantity: 1 \}\]/);
});

test("checkout configuration documents every required environment variable by name", async () => {
  const source = await readFile(envUrl, "utf8");

  for (const name of [
    "DODO_PAYMENTS_API_KEY",
    "DODO_PAYMENTS_WEBHOOK_KEY",
    "DODO_CHECKOUT_RETURN_URL",
    "DODO_PRODUCT_CREDITS_1M",
    "DODO_PRODUCT_CREDITS_3M",
    "DODO_PRODUCT_CREDITS_10M",
  ]) {
    assert.match(source, new RegExp(`^${name}=`, "m"));
  }
});
