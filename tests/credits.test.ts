import assert from "node:assert/strict";
import test from "node:test";

import {
  InsufficientCreditsError,
  MemoryCreditsStore,
  STARTER_CREDITS,
  createCreditsService,
} from "../convex/credits";

test("grants starter credits exactly once for an organization", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });

  const first = await service.ensureStarterGrant({ organizationId: "org_a" });
  const duplicate = await service.ensureStarterGrant({ organizationId: "org_a" });
  const wallet = await service.getWallet({ organizationId: "org_a" });

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(wallet.available, STARTER_CREDITS);
  assert.equal(wallet.granted, STARTER_CREDITS);
  assert.equal(wallet.reserved, 0);
  assert.equal(wallet.consumed, 0);
});

test("does not silently accept a conflicting transaction under the starter idempotency key", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.grantCredits({
    organizationId: "org_a",
    amount: 1,
    idempotencyKey: "starter:org_a",
  });

  await assert.rejects(
    service.ensureStarterGrant({ organizationId: "org_a" }),
    /different starter grant inputs/,
  );
  assert.equal((await service.getWallet({ organizationId: "org_a" })).available, 1);
});

test("rejects cross-operation reuse of a transaction idempotency key", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.grantCredits({
    organizationId: "org_a",
    amount: 100,
    idempotencyKey: "operation_1",
  });

  await assert.rejects(
    service.reserveCredits({
      organizationId: "org_a",
      operationId: "run_1",
      operation: "ai_chat",
      amount: 10,
      idempotencyKey: "operation_1",
      expiresAt: 2_000,
    }),
    /Transaction idempotency key was already used/,
  );
  assert.equal((await service.getWallet({ organizationId: "org_a" })).available, 100);
});

test("rejects a reservation that would make available credits negative", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });

  await assert.rejects(
    service.reserveCredits({
      organizationId: "org_a",
      operationId: "run_1",
      operation: "ai_chat",
      amount: STARTER_CREDITS + 1,
      idempotencyKey: "reserve:run_1",
      expiresAt: 2_000,
    }),
    InsufficientCreditsError,
  );

  assert.deepEqual(await service.getWallet({ organizationId: "org_a" }), {
    organizationId: "org_a",
    granted: STARTER_CREDITS,
    available: STARTER_CREDITS,
    reserved: 0,
    consumed: 0,
    updatedAt: 1_000,
  });
});

test("coalesces two concurrent reservations with the same idempotency key", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const args = {
    organizationId: "org_a",
    operationId: "run_1",
    operation: "ai_chat" as const,
    amount: 600_000,
    idempotencyKey: "reserve:run_1",
    expiresAt: 2_000,
  };

  const [first, duplicate] = await Promise.all([
    service.reserveCredits(args),
    service.reserveCredits(args),
  ]);

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(first.reservation.id, duplicate.reservation.id);
  assert.equal((await service.getWallet({ organizationId: "org_a" })).reserved, 600_000);
});

test("finalizes the measured debit and releases the unused reservation", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const { reservation } = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "run_1",
    operation: "analysis",
    amount: 100,
    idempotencyKey: "reserve:run_1",
    expiresAt: 2_000,
  });

  const result = await service.finalizeReservation({
    organizationId: "org_a",
    reservationId: reservation.id,
    measuredCredits: 40,
    idempotencyKey: "finalize:run_1",
  });

  assert.equal(result.finalDebit, 40);
  assert.equal(result.releasedCredits, 60);
  assert.equal(result.reservation.status, "finalized");
  assert.equal(result.reservation.rateCardVersion, "2026-07-14.poc-v1");
  assert.deepEqual(await service.getWallet({ organizationId: "org_a" }), {
    organizationId: "org_a",
    granted: STARTER_CREDITS,
    available: STARTER_CREDITS - 40,
    reserved: 0,
    consumed: 40,
    updatedAt: 1_000,
  });
});

test("releases a reservation without consuming credits after a pre-provider failure", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const { reservation } = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "email_batch_1",
    operation: "email_delivery",
    amount: 200,
    idempotencyKey: "reserve:email_batch_1",
    expiresAt: 2_000,
  });

  const released = await service.releaseReservation({
    organizationId: "org_a",
    reservationId: reservation.id,
    idempotencyKey: "release:email_batch_1",
    reason: "provider_not_called",
  });

  assert.equal(released.releasedCredits, 200);
  assert.equal(released.reservation.status, "released");
  assert.deepEqual(await service.getWallet({ organizationId: "org_a" }), {
    organizationId: "org_a",
    granted: STARTER_CREDITS,
    available: STARTER_CREDITS,
    reserved: 0,
    consumed: 0,
    updatedAt: 1_000,
  });
});

test("finalization retries are idempotent and cannot change measured usage", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const { reservation } = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "voice_1",
    operation: "connected_voice",
    amount: 2_400,
    idempotencyKey: "reserve:voice_1",
    expiresAt: 2_000,
  });
  const args = {
    organizationId: "org_a",
    reservationId: reservation.id,
    measuredCredits: 1_200,
    idempotencyKey: "finalize:voice_1",
  };

  const first = await service.finalizeReservation(args);
  const duplicate = await service.finalizeReservation(args);

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(first.debitTransaction?.id, duplicate.debitTransaction?.id);
  await assert.rejects(
    service.finalizeReservation({ ...args, measuredCredits: 1_201 }),
    /different finalization inputs/,
  );
});

test("release retries are idempotent", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const { reservation } = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "source_1",
    operation: "source_processing",
    amount: 100,
    idempotencyKey: "reserve:source_1",
    expiresAt: 2_000,
  });
  const args = {
    organizationId: "org_a",
    reservationId: reservation.id,
    idempotencyKey: "release:source_1",
    reason: "provider_not_called",
  };

  const first = await service.releaseReservation(args);
  const duplicate = await service.releaseReservation(args);

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(first.transaction.id, duplicate.transaction.id);
});

test("expires active reservations and restores their full amount", async () => {
  let now = 1_000;
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => now,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  await service.reserveCredits({
    organizationId: "org_a",
    operationId: "report_1",
    operation: "report_generation",
    amount: 500,
    idempotencyKey: "reserve:report_1",
    expiresAt: 2_000,
  });
  now = 2_001;

  const result = await service.releaseExpiredReservations({ organizationId: "org_a" });

  assert.equal(result.expiredCount, 1);
  assert.equal(result.releasedCredits, 500);
  assert.equal((await service.getWallet({ organizationId: "org_a" })).available, STARTER_CREDITS);
});

test("checks organization access before returning a wallet", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    authorize: async (organizationId) => {
      if (organizationId !== "org_a") throw new Error("Workspace not found");
    },
  });

  await assert.rejects(
    service.getWallet({ organizationId: "org_b" }),
    /Workspace not found/,
  );
});

test("reconciles exact provider usage to the reservation rate-card version once", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const { reservation } = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "analysis_1",
    operation: "analysis",
    amount: 10,
    idempotencyKey: "reserve:analysis_1",
    expiresAt: 2_000,
    rateCardVersion: "2026-07-14.poc-v1",
  });
  const args = {
    organizationId: "org_a",
    reservationId: reservation.id,
    provider: "openai",
    providerOperationId: "response_1",
    nativeQuantity: 1_500,
    internalCostMicros: 12_345,
    model: "gpt-test",
  };

  const first = await service.reconcileUsage(args);
  const duplicate = await service.reconcileUsage(args);

  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(first.usage.id, duplicate.usage.id);
  assert.deepEqual(first.usage, {
    id: first.usage.id,
    organizationId: "org_a",
    reservationId: reservation.id,
    operation: "analysis",
    model: "gpt-test",
    provider: "openai",
    providerOperationId: "response_1",
    nativeQuantity: 1_500,
    nativeUnit: "token",
    internalCostMicros: 12_345,
    billedCredits: 10,
    measuredCredits: 10,
    shortfallCredits: 0,
    creditTransactionId: first.finalization.debitTransaction!.id,
    rateCardVersion: "2026-07-14.poc-v1",
    finalized: true,
    createdAt: 1_000,
  });
  assert.equal((await service.getWallet({ organizationId: "org_a" })).consumed, 10);
});

test("cannot reuse a provider operation ID for a different reservation", async () => {
  const service = createCreditsService(new MemoryCreditsStore(), {
    id: sequenceIds(),
    now: () => 1_000,
  });
  await service.ensureStarterGrant({ organizationId: "org_a" });
  const first = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "run_1",
    operation: "ai_chat",
    amount: 10,
    idempotencyKey: "reserve:run_1",
    expiresAt: 2_000,
  });
  const second = await service.reserveCredits({
    organizationId: "org_a",
    operationId: "run_2",
    operation: "ai_chat",
    amount: 10,
    idempotencyKey: "reserve:run_2",
    expiresAt: 2_000,
  });
  const usage = {
    organizationId: "org_a",
    provider: "openai",
    providerOperationId: "response_1",
    nativeQuantity: 1_000,
    internalCostMicros: 1,
    model: "gpt-test",
  };
  await service.reconcileUsage({ ...usage, reservationId: first.reservation.id });

  await assert.rejects(
    service.reconcileUsage({ ...usage, reservationId: second.reservation.id }),
    /different usage inputs/,
  );
});

function sequenceIds() {
  let value = 0;
  return () => `id_${++value}`;
}
