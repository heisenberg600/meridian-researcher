import assert from "node:assert/strict";
import test from "node:test";

import {
  MemoryCheckoutStore,
  TOP_UP_PACKS,
  createPaymentsService,
  type CheckoutProvider,
} from "../convex/payments";

test("creates a persisted top-up intent before returning a hosted checkout", async () => {
  const requests: Parameters<CheckoutProvider["createCheckout"]>[0][] = [];
  const provider: CheckoutProvider = {
    async createCheckout(request) {
      requests.push(request);
      return { sessionId: "cks_1", checkoutUrl: "https://test.checkout.dodopayments.com/cks_1" };
    },
  };
  const service = createPaymentsService(new MemoryCheckoutStore(), provider, {
    id: () => "intent_1",
    now: () => 1_000,
    returnUrl: "https://app.example.test/billing?checkout=return",
    productIds: { credits_1m: "prod_test_1m" },
  });

  const result = await service.createTopUpCheckout({
    organizationId: "org_a",
    packKey: "credits_1m",
    idempotencyKey: "checkout:org_a:request_1",
  });

  assert.equal(result.status, "created");
  assert.equal(result.checkout.expectedGrant, TOP_UP_PACKS.credits_1m.credits);
  assert.equal(result.checkout.dodoSessionId, "cks_1");
  assert.equal(result.checkout.checkoutUrl, "https://test.checkout.dodopayments.com/cks_1");
  assert.deepEqual(requests, [{
    productId: "prod_test_1m",
    quantity: 1,
    returnUrl: "https://app.example.test/billing?checkout=return",
    idempotencyKey: "checkout:org_a:request_1",
    metadata: {
      meridian_checkout_intent_id: "intent_1",
      meridian_organization_id: "org_a",
      meridian_pack_key: "credits_1m",
      meridian_expected_grant: String(TOP_UP_PACKS.credits_1m.credits),
    },
  }]);
});

test("rejects an unsafe checkout URL returned by the payment provider", async () => {
  const service = createPaymentsService(
    new MemoryCheckoutStore(),
    {
      async createCheckout() {
        return { sessionId: "cks_1", checkoutUrl: "javascript:alert(1)" };
      },
    },
    {
      id: () => "intent_1",
      now: () => 1_000,
      returnUrl: "https://app.example.test/billing?checkout=return",
      productIds: { credits_1m: "prod_test_1m" },
    },
  );

  await assert.rejects(
    service.createTopUpCheckout({
      organizationId: "org_a",
      packKey: "credits_1m",
      idempotencyKey: "checkout:org_a:request_1",
    }),
    /secure HTTPS URL/,
  );
});
