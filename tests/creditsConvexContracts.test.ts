import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const creditsUrl = new URL("../convex/credits.ts", import.meta.url);
const usersUrl = new URL("../convex/users.ts", import.meta.url);
const meridianDataUrl = new URL("../convex/meridianData.ts", import.meta.url);

test("billing exposes durable authorized Convex wallet and reservation functions", async () => {
  const source = await readFile(creditsUrl, "utf8");

  for (const contract of [
    /export const getWallet = query\(/,
    /export const usageHistory = query\(/,
    /export const reserveCredits = mutation\(/,
    /export const ensureStarterGrant = internalMutation\(/,
    /export const reconcileUsage = internalMutation\(/,
    /export const releaseReservation = internalMutation\(/,
    /export const expireReservations = internalMutation\(/,
  ]) {
    assert.match(source, contract);
  }
  assert.ok(
    (source.match(/requireOrganizationAccess\(ctx, args\.organizationId\)/g)?.length ?? 0) >= 3,
    "every public billing operation must require organization access",
  );
});

test("workspace provisioning creates the wallet and starter grant in the same mutation", async () => {
  const [credits, users] = await Promise.all([
    readFile(creditsUrl, "utf8"),
    readFile(usersUrl, "utf8"),
  ]);

  assert.match(credits, /export async function ensureStarterGrantForOrganization/);
  assert.match(users, /ensureStarterGrantForOrganization\(ctx, organizationId, now\)/);
});

test("usage writes accept exact provider and prepaid reconciliation fields", async () => {
  const source = await readFile(meridianDataUrl, "utf8");

  for (const field of [
    "provider",
    "providerOperationId",
    "nativeQuantity",
    "nativeUnit",
    "internalCostMicros",
    "billedCredits",
    "creditTransactionId",
    "rateCardVersion",
    "finalized",
  ]) {
    assert.match(source, new RegExp(`${field}: v\\.optional`), `recordUsage must accept ${field}`);
  }
});
