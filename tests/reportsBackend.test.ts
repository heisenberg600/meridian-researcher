import assert from "node:assert/strict";
import test from "node:test";

import schema from "../convex/schema";
import {
  assertReportSectionUpdate,
  getReportDownloadUrl,
  publishReport,
  updateReportSection,
} from "../convex/reports";
import {
  REPORT_GENERATION_CREDITS,
  reportReservationKey,
  reportSettlementInput,
} from "../convex/reportActions";

const handler = <TArgs, TResult>(value: unknown) =>
  (value as { _handler: (ctx: unknown, args: TArgs) => Promise<TResult> })._handler;

test("report schema persists immutable documents, exports, publication, and reconciled credits", () => {
  const fields = tableFields("reportVersions");
  for (const field of [
    "document",
    "brandSnapshot",
    "analysisSnapshot",
    "reservationId",
    "pdfStorageId",
    "pptxStorageId",
    "finalizedCredits",
    "publishedBy",
    "publishedAt",
  ]) assert.ok(fields.has(field), `reportVersions must persist ${field}`);
});

test("section edits preserve evidence-linked claim IDs and reject published report mutation", () => {
  const original = section("Finding", ["finding-1"]);
  assert.deepEqual(assertReportSectionUpdate(original, {
    ...original, title: " Revised finding ", summary: "Summary", body: ["Body"], claims: original.claims,
  }), { ...original, title: "Revised finding", summary: "Summary", body: ["Body"] });
  assert.throws(() => assertReportSectionUpdate(original, {
    ...original, title: "Finding", summary: "Summary", body: [], claims: [{ id: "claim-1", text: "Ungrounded", findingIds: [] }],
  }), /at least one finding/i);
  assert.throws(() => assertReportSectionUpdate(original, {
    ...original, claims: [{ id: "claim-1", text: "Unknown proof", findingIds: ["finding-2"] }],
  }, new Set(["finding-1"])), /unknown finding/i);
});

test("report generation reserves and reconciles exactly one report unit", () => {
  assert.equal(REPORT_GENERATION_CREDITS, 500);
  assert.equal(reportReservationKey("report-7"), "report:report-7");
  assert.deepEqual(reportSettlementInput({ organizationId: "org-1", reservationId: "reservation-1", reportVersionId: "report-7" }), {
    organizationId: "org-1",
    reservationId: "reservation-1",
    provider: "meridian-report-renderer",
    providerOperationId: "report-7",
    nativeQuantity: 1,
    internalCostMicros: 0,
    model: "structured-document-v1",
  });
});

test("report reads, edits, publishing, and download URLs require study organization access", async () => {
  const foreign = reportDoc({ organizationId: "org-2" });
  const ctx = fakeCtx(foreign);
  for (const operation of [
    () => handler<{ reportVersionId: string; sectionId: string; section: ReturnType<typeof section> }, unknown>(updateReportSection)(ctx, { reportVersionId: "report-1", sectionId: "section-key_findings", section: section("Changed", ["finding-1"]) }),
    () => handler<{ reportVersionId: string }, unknown>(publishReport)(ctx, { reportVersionId: "report-1" }),
    () => handler<{ reportVersionId: string; format: "pdf" }, unknown>(getReportDownloadUrl)(ctx, { reportVersionId: "report-1", format: "pdf" }),
  ]) await assert.rejects(operation, /workspace not found/i);
});

test("published report returns an authorized storage URL for the requested format", async () => {
  const ctx = fakeCtx(reportDoc({ status: "published" }));
  const result = await handler<{ reportVersionId: string; format: "pptx" }, { url: string; filename: string }>(getReportDownloadUrl)(ctx, { reportVersionId: "report-1", format: "pptx" });
  assert.deepEqual(result, { url: "https://storage.local/pptx-1", filename: "research-report-v1.pptx" });
});

function section(title: string, findingIds: string[]) {
  return { id: "section-key_findings", kind: "key_findings" as const, title, summary: "Summary", body: [], claims: [{ id: "claim-1", text: "Claim", findingIds }] };
}

function reportDoc(overrides: Record<string, unknown> = {}) {
  return { _id: "report-1", organizationId: "org-1", studyId: "study-1", version: 1, status: "ready", pdfStorageId: "pdf-1", pptxStorageId: "pptx-1", document: { sections: [section("Finding", ["finding-1"])] }, ...overrides };
}

function fakeCtx(report: ReturnType<typeof reportDoc>) {
  const docs: Record<string, Record<string, unknown>> = {
    "report-1": report,
    "study-1": { _id: "study-1", organizationId: report.organizationId },
    "user-1": { _id: "user-1", authTokenIdentifier: "token-1", defaultOrganizationId: "org-1" },
  };
  return {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "token-1" }) },
    db: {
      get: async (id: string) => docs[id] ?? null,
      patch: async (id: string, value: Record<string, unknown>) => { Object.assign(docs[id]!, value); },
      query: (table: string) => ({ withIndex: (_name: string, cb: (q: { eq: (field: string, value: string) => unknown }) => unknown) => {
        const filters: Record<string, string> = {};
        const q = { eq(field: string, value: string) { filters[field] = value; return q; } };
        cb(q);
        return { unique: async () => table === "users" ? docs["user-1"] : table === "memberships" && filters.organizationId === "org-1" ? { organizationId: "org-1", userId: "user-1" } : null };
      } }),
    },
    storage: { getUrl: async (id: string) => `https://storage.local/${id}` },
  };
}

type TableContract = { validator: { json: { value: Record<string, unknown> } } };
function tableFields(tableName: string) {
  const table = (schema.tables as Record<string, unknown>)[tableName] as TableContract;
  return new Set(Object.keys(table.validator.json.value));
}
