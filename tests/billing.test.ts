import assert from "node:assert/strict";
import test from "node:test";

import { calculateBillableCredits } from "../convex/lib/billing";

test("rounds billable native units up to whole credit blocks", () => {
  const charge = calculateBillableCredits({
    operation: "ai_chat",
    nativeQuantity: 1_500,
  });

  assert.equal(charge.credits, 2);
  assert.equal(charge.nativeQuantity, 1_500);
  assert.equal(charge.nativeUnit, "token");
  assert.equal(charge.rateCardVersion, "2026-07-14.poc-v1");
});

test("rejects fractional, negative, and unsafe native quantities", () => {
  for (const nativeQuantity of [1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => calculateBillableCredits({ operation: "ai_chat", nativeQuantity }),
      /safe non-negative integer/,
    );
  }
});

test("the versioned POC rate card covers every planned billable operation", () => {
  const sampleQuantities = {
    ai_chat: 1_000,
    source_processing: 1,
    email_delivery: 1,
    connected_voice: 60,
    analysis: 1_000,
    report_generation: 1,
    image_generation: 1,
  } as const;

  const charges = Object.entries(sampleQuantities).map(([operation, nativeQuantity]) =>
    calculateBillableCredits({
      operation: operation as keyof typeof sampleQuantities,
      nativeQuantity,
      rateCardVersion: "2026-07-14.poc-v1",
    }),
  );

  assert.equal(charges.length, 7);
  assert.ok(charges.every((charge) => charge.credits > 0));
  assert.ok(
    charges.find((charge) => charge.operation === "connected_voice")!.credits >
      charges.find((charge) => charge.operation === "ai_chat")!.credits,
  );
});
