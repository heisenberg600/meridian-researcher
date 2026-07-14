import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validatePersistedPayment } from "../convex/paymentWebhooks";

const storeUrl = new URL("../convex/paymentWebhooks.ts", import.meta.url);
const actionsUrl = new URL("../convex/paymentWebhookActions.ts", import.meta.url);
const wrapperUrl = new URL("../convex/paymentWebhookHttp.ts", import.meta.url);
const httpUrl = new URL("../convex/http.ts", import.meta.url);

test("webhook persistence exposes durable event and atomic payment mutations", async () => {
  const source = await readFile(storeUrl, "utf8");

  assert.match(source, /export const receiveEvent = internalMutation\(/);
  assert.match(source, /export const processVerifiedPayment = internalMutation\(/);
  assert.match(source, /export const markEventProcessed = internalMutation\(/);
  assert.match(source, /export const markEventFailed = internalMutation\(/);
  assert.match(source, /providerPaymentId:/);
  assert.match(source, /dodoPaymentId:/);
});

test("HTTP webhook verifies the untouched body with the official Dodo SDK", async () => {
  const source = await readFile(actionsUrl, "utf8").catch(() => "");
  const wrapperSource = await readFile(wrapperUrl, "utf8").catch(() => "");
  const httpSource = await readFile(httpUrl, "utf8").catch(() => "");

  assert.match(source, /import DodoPayments from "dodopayments"/);
  assert.match(source, /environment: "test_mode"/);
  assert.match(wrapperSource, /await request\.text\(\)/);
  assert.equal(wrapperSource.match(/request\.text\(\)/g)?.length, 1);
  assert.match(wrapperSource, /ctx\.runAction\(verifyAndProcessRef/);
  assert.match(source, /client\.webhooks\.unwrap\(rawBody, \{ headers, key \}\)/);
  assert.doesNotMatch(source, /unsafeUnwrap/);
  assert.doesNotMatch(source, /data\.metadata|metadata\./);
  assert.match(httpSource, /path: "\/dodo\/webhooks"/);
  assert.match(httpSource, /method: "POST"/);
});

test("payment grants are derived from the persisted Test Mode checkout, not metadata", () => {
  const checkout = {
    organizationId: "org_a",
    dodoSessionId: "cks_1",
    productId: "prod_1m",
    mode: "test" as const,
    expectedGrant: 1_000_000,
    status: "created" as const,
  };
  const payment = {
    paymentId: "pay_1",
    checkoutSessionId: "cks_1",
    productCart: [{ productId: "prod_1m", quantity: 1 }],
  };

  assert.deepEqual(validatePersistedPayment(checkout, payment, "test"), {
    organizationId: "org_a",
    expectedGrant: 1_000_000,
  });
  assert.throws(
    () => validatePersistedPayment(checkout, { ...payment, checkoutSessionId: "cks_other" }, "test"),
    /session/i,
  );
  assert.throws(
    () => validatePersistedPayment(checkout, {
      ...payment,
      productCart: [{ productId: "prod_other", quantity: 1 }],
    }, "test"),
    /product/i,
  );
  assert.throws(
    () => validatePersistedPayment(checkout, {
      ...payment,
      productCart: [{ productId: "prod_1m", quantity: 2 }],
    }, "test"),
    /product/i,
  );
  assert.throws(
    () => validatePersistedPayment({ ...checkout, mode: "live" }, payment, "test"),
    /mode/i,
  );
});
