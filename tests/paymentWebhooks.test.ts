import assert from "node:assert/strict";
import test from "node:test";

import { MemoryCreditsStore, createCreditsService } from "../convex/credits";
import {
  MemoryWebhookEventStore,
  processDodoWebhook,
  type RawWebhookVerifier,
} from "../convex/paymentWebhooks";
import { MemoryCheckoutStore, createPaymentsService } from "../convex/payments";

test("verifies the exact raw body and grants a paid checkout only once", async () => {
  const checkoutStore = new MemoryCheckoutStore();
  const payments = createPaymentsService(
    checkoutStore,
    {
      async createCheckout() {
        return { sessionId: "cks_1", checkoutUrl: "https://checkout.test/cks_1" };
      },
    },
    {
      id: () => "intent_1",
      now: () => 1_000,
      returnUrl: "https://app.example.test/billing?checkout=return",
      productIds: { credits_1m: "prod_1m" },
    },
  );
  await payments.createTopUpCheckout({
    organizationId: "org_a",
    packKey: "credits_1m",
    idempotencyKey: "checkout:org_a:1",
  });
  const credits = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  const rawBody = '{ "type": "payment.succeeded", "data": { "payment_id": "pay_1" } }\n';
  let verifiedRawBody = "";
  const verifier: RawWebhookVerifier = {
    async verify(body, headers) {
      verifiedRawBody = body;
      assert.equal(headers["webhook-id"], "evt_1");
      return {
        eventId: "evt_1",
        eventType: "payment.succeeded",
        paymentId: "pay_1",
        checkoutSessionId: "cks_1",
        checkoutIntentId: "intent_1",
        organizationId: "org_a",
      };
    },
  };
  const eventStore = new MemoryWebhookEventStore();
  const request = {
    rawBody,
    headers: {
      "webhook-id": "evt_1",
      "webhook-signature": "v1,test-signature",
      "webhook-timestamp": "1000",
    },
  } as const;

  const first = await processDodoWebhook(request, { verifier, eventStore, payments, credits });
  const duplicate = await processDodoWebhook(request, { verifier, eventStore, payments, credits });

  assert.equal(verifiedRawBody, rawBody);
  assert.equal(first.status, "processed");
  assert.equal(duplicate.status, "duplicate");
  assert.equal((await credits.getWallet({ organizationId: "org_a" })).available, 1_000_000);
  assert.equal((await eventStore.get("evt_1"))?.status, "processed");
});

test("does not persist or grant an event when raw-body verification fails", async () => {
  const checkoutStore = new MemoryCheckoutStore();
  const payments = createPaymentsService(
    checkoutStore,
    { async createCheckout() { throw new Error("not called"); } },
    {
      returnUrl: "https://app.example.test/billing?checkout=return",
      productIds: { credits_1m: "prod_1m" },
    },
  );
  const credits = createCreditsService(new MemoryCreditsStore());
  const eventStore = new MemoryWebhookEventStore();
  const verifier: RawWebhookVerifier = {
    async verify() {
      throw new Error("Invalid webhook signature");
    },
  };

  await assert.rejects(
    processDodoWebhook({
      rawBody: "{}",
      headers: {
        "webhook-id": "evt_bad",
        "webhook-signature": "v1,bad",
        "webhook-timestamp": "1000",
      },
    }, { verifier, eventStore, payments, credits }),
    /Invalid webhook signature/,
  );

  assert.equal(await eventStore.get("evt_bad"), undefined);
  assert.equal((await credits.getWallet({ organizationId: "org_a" })).available, 0);
});

test("rejects a signed payment that does not match the persisted checkout session", async () => {
  const checkoutStore = new MemoryCheckoutStore();
  const payments = createPaymentsService(
    checkoutStore,
    {
      async createCheckout() {
        return { sessionId: "cks_1", checkoutUrl: "https://checkout.test/cks_1" };
      },
    },
    {
      id: () => "intent_1",
      now: () => 1_000,
      returnUrl: "https://app.example.test/billing?checkout=return",
      productIds: { credits_1m: "prod_1m" },
    },
  );
  await payments.createTopUpCheckout({
    organizationId: "org_a",
    packKey: "credits_1m",
    idempotencyKey: "checkout:org_a:1",
  });
  const credits = createCreditsService(new MemoryCreditsStore());
  const eventStore = new MemoryWebhookEventStore();
  const verifier: RawWebhookVerifier = {
    async verify() {
      return {
        eventId: "evt_wrong_session",
        eventType: "payment.succeeded",
        paymentId: "pay_1",
        checkoutSessionId: "cks_other",
        checkoutIntentId: "intent_1",
        organizationId: "org_a",
      };
    },
  };

  await assert.rejects(
    processDodoWebhook({
      rawBody: "{}",
      headers: {
        "webhook-id": "evt_wrong_session",
        "webhook-signature": "v1,test-signature",
        "webhook-timestamp": "1000",
      },
    }, { verifier, eventStore, payments, credits }),
    /does not match the persisted intent/,
  );

  assert.equal((await credits.getWallet({ organizationId: "org_a" })).available, 0);
  assert.equal((await eventStore.get("evt_wrong_session"))?.status, "failed");
});

test("replays a received event after a crash without granting credits twice", async () => {
  const checkoutStore = new MemoryCheckoutStore();
  const payments = createPaymentsService(
    checkoutStore,
    {
      async createCheckout() {
        return { sessionId: "cks_retry", checkoutUrl: "https://checkout.test/cks_retry" };
      },
    },
    {
      id: () => "intent_retry",
      returnUrl: "https://app.example.test/billing?checkout=return",
      productIds: { credits_1m: "prod_1m" },
    },
  );
  await payments.createTopUpCheckout({
    organizationId: "org_retry",
    packKey: "credits_1m",
    idempotencyKey: "checkout:org_retry:1",
  });
  const durableCredits = createCreditsService(new MemoryCreditsStore());
  let attempts = 0;
  const credits = {
    async grantCredits(args: Parameters<typeof durableCredits.grantCredits>[0]) {
      attempts += 1;
      if (attempts === 1) throw new Error("crash after payment transition");
      return await durableCredits.grantCredits(args);
    },
  };
  const eventStore = new MemoryWebhookEventStore();
  const verifier: RawWebhookVerifier = {
    async verify() {
      return {
        eventId: "evt_retry",
        eventType: "payment.succeeded",
        paymentId: "pay_retry",
        checkoutSessionId: "cks_retry",
        checkoutIntentId: "intent_retry",
        organizationId: "org_retry",
      };
    },
  };
  const request = {
    rawBody: '{"type":"payment.succeeded"}',
    headers: {
      "webhook-id": "evt_retry",
      "webhook-signature": "v1,test-signature",
      "webhook-timestamp": "1000",
    },
  } as const;

  await assert.rejects(
    processDodoWebhook(request, { verifier, eventStore, payments, credits }),
    /crash after payment transition/,
  );
  assert.equal((await eventStore.get("evt_retry"))?.status, "failed");

  const replay = await processDodoWebhook(request, { verifier, eventStore, payments, credits });
  assert.equal(replay.status, "processed");
  assert.equal(
    (await durableCredits.getWallet({ organizationId: "org_retry" })).available,
    1_000_000,
  );
  assert.equal(attempts, 2);
});

function sequenceIds() {
  let value = 0;
  return () => `id_${++value}`;
}
