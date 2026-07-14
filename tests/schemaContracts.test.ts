import assert from "node:assert/strict";
import test from "node:test";

import schema from "../convex/schema";

const requiredTables = [
  "knowledgeSources",
  "studyMemories",
  "brandProfiles",
  "participantImportBatches",
  "participantImportRows",
  "suppressionEntries",
  "outreachBatches",
  "responseEvidence",
  "analysisRuns",
  "findings",
  "reportVersions",
  "billingAccounts",
  "creditWallets",
  "creditTransactions",
  "creditReservations",
  "checkoutSessions",
  "paymentWebhookEvents",
  "rateCards",
] as const;

test("the schema exposes every end-to-end Meridian domain table", () => {
  const tableNames = new Set(Object.keys(schema.tables));
  for (const tableName of requiredTables) {
    assert.ok(tableNames.has(tableName), `schema must define ${tableName}`);
  }
});

type TableContract = {
  validator: {
    json: {
      value: Record<string, unknown>;
    };
  };
};

function tableFields(tableName: string) {
  const table = (schema.tables as Record<string, unknown>)[tableName] as TableContract;
  return new Set(Object.keys(table.validator.json.value));
}

test("billing persistence includes recovery and reconciliation fields", () => {
  const expectedFields: Record<string, string[]> = {
    checkoutSessions: [
      "checkoutIntentId",
      "idempotencyKey",
      "dodoSessionId",
      "dodoPaymentId",
      "checkoutUrl",
      "productId",
      "mode",
    ],
    creditReservations: [
      "measuredCredits",
      "shortfallCredits",
      "finalizationIdempotencyKey",
      "releaseIdempotencyKey",
    ],
    creditTransactions: ["reservationId", "reason", "providerPaymentId"],
    paymentWebhookEvents: ["organizationId", "paymentId", "checkoutSessionId"],
    rateCards: ["nativeUnitsPerBlock", "creditsPerBlock"],
  };

  for (const [tableName, fields] of Object.entries(expectedFields)) {
    const actual = tableFields(tableName);
    for (const field of fields) {
      assert.ok(actual.has(field), `${tableName} must persist ${field}`);
    }
  }
});
