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
