import assert from "node:assert/strict";
import test from "node:test";

import {
  approveImport,
  approveManualSelection,
  createImport,
  inferMapping,
  inferMappingSuggestions,
  updateRow,
  validateRows,
} from "../convex/participantImports";

test("suggests deterministic participant fields from robust header aliases", async () => {
  const result = await inferMappingSuggestions([
    "Participant Name",
    "Work Email",
    "Mobile Number",
    "Cohort",
    "Contact Method",
    "Research Notes",
  ]);

  assert.deepEqual(result.mapping, {
    name: ["Participant Name"],
    email: ["Work Email"],
    phone: ["Mobile Number"],
    segment: ["Cohort"],
    preferredMode: ["Contact Method"],
    notes: ["Research Notes"],
  });
  assert.equal(result.requiresReview, false);
  assert.ok(result.suggestions.every((suggestion) => suggestion.source === "deterministic"));
});

test("keeps optional assistant inference as review-only suggestions", async () => {
  let calls = 0;
  const result = await inferMappingSuggestions(["Person", "Contact"], {
    context: { companyMemory: ["Customers are B2B operators"], studyMemory: [] },
    assistant: {
      async suggest() {
        calls += 1;
        return [
          { field: "name" as const, sourceColumns: ["Person"], reason: "Likely a name" },
          { field: "email" as const, sourceColumns: ["Contact"], reason: "Could be email" },
        ];
      },
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result.mapping, {});
  assert.equal(result.requiresReview, true);
  assert.deepEqual(
    result.suggestions.map(({ field, confidence, source }) => ({ field, confidence, source })),
    [
      { field: "name", confidence: "ambiguous", source: "assistant" },
      { field: "email", confidence: "ambiguous", source: "assistant" },
    ],
  );
});

test("exposes deterministic mapping through an authorized Convex query", async () => {
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const patches: Array<{ id: string; value: Record<string, unknown> }> = [];
  const result = await invokeMapping(
    inferMapping,
    participantImportContext({ inserts, patches }),
    {
      studyId: "study-1",
      headers: ["Participant Name", "Work Email"],
      sampleRows: [{ "Participant Name": "Asha", "Work Email": "asha@example.com" }],
    },
  );

  assert.deepEqual(result.mapping, {
    name: ["Participant Name"],
    email: ["Work Email"],
  });
});

test("normalizes mapped fields and keeps invalid source values visible for review", async () => {
  const rows = await validateRows({
    rows: [
      {
        First: "  Ana ",
        Last: " García  ",
        Email: " ANA.GARCIA@Example.COM ",
        Phone: "00 44 20 7946 0123",
        Segment: "  Enterprise   buyers ",
        Mode: "",
        Notes: "  Available Tuesday  ",
      },
      {
        First: "",
        Last: "",
        Email: "not-an-email",
        Phone: "(12)",
        Segment: "",
        Mode: "hologram",
        Notes: "",
      },
    ],
    mapping: {
      name: ["First", "Last"],
      email: ["Email"],
      phone: ["Phone"],
      segment: ["Segment"],
      preferredMode: ["Mode"],
      notes: ["Notes"],
    },
    policy: emptyContactPolicy,
  });

  assert.deepEqual(rows[0].normalized, {
    name: "Ana García",
    email: "ana.garcia@example.com",
    phone: "+442079460123",
    segment: "Enterprise buyers",
    preferredMode: "either",
    notes: "Available Tuesday",
  });
  assert.equal(rows[0].disposition, "ready");
  assert.deepEqual(rows[0].issues, []);
  assert.deepEqual(rows[1].normalized, {
    email: "not-an-email",
    phone: "12",
  });
  assert.deepEqual(rows[1].issues, [
    "Participant name is required",
    "Email address is invalid",
    "Phone number is invalid",
    "Preferred mode is invalid",
    "Add a valid email address or phone number",
  ]);
  assert.equal(rows[1].disposition, "needs_review");
});

test("flags every within-file duplicate, existing contact, and suppressed contact", async () => {
  const seen: Array<{ emails: string[]; phones: string[] }> = [];
  const rows = await validateRows({
    rows: [
      { Name: "Alpha", Email: "DUPE@example.com", Phone: "" },
      { Name: "Beta", Email: "dupe@example.com", Phone: "" },
      { Name: "Gamma", Email: "existing@example.com", Phone: "" },
      { Name: "Delta", Email: "", Phone: "+44 20 7000 0000" },
    ],
    mapping: { name: ["Name"], email: ["Email"], phone: ["Phone"] },
    policy: {
      async findExisting(contacts) {
        seen.push(contacts);
        return { emails: ["existing@example.com"], phones: [] };
      },
      async findSuppressed(contacts) {
        seen.push(contacts);
        return { emails: [], phones: ["+442070000000"] };
      },
    },
  });

  assert.equal(seen.length, 2);
  assert.equal(rows[0].duplicate, true);
  assert.equal(rows[1].duplicate, true);
  assert.ok(rows[0].issues.includes("Duplicate contact in this import"));
  assert.ok(rows[1].issues.includes("Duplicate contact in this import"));
  assert.equal(rows[2].duplicate, true);
  assert.ok(rows[2].issues.includes("Contact already exists in this study"));
  assert.equal(rows[3].suppressed, true);
  assert.equal(rows[3].disposition, "excluded");
  assert.ok(rows[3].issues.includes("Contact is suppressed for this workspace"));
});

test("creates a review batch without materializing participant records", async (context) => {
  context.mock.method(Date, "now", () => 1_000);
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const patches: Array<{ id: string; value: Record<string, unknown> }> = [];
  const ctx = participantImportContext({ inserts, patches });

  const result = await invoke(createImport, ctx, {
    studyId: "study-1",
    filename: "participants.csv",
    mapping: { name: ["Name"], email: ["Email"] },
    rows: [
      { Name: "Valid Person", Email: "valid@example.com" },
      { Name: "Missing Contact", Email: "" },
    ],
  });

  assert.deepEqual(result.counts, {
    totalRows: 2,
    validRows: 1,
    invalidRows: 1,
    duplicateRows: 0,
    suppressedRows: 0,
  });
  assert.equal(inserts.filter(({ table }) => table === "participantImportBatches").length, 1);
  assert.equal(inserts.filter(({ table }) => table === "participantImportRows").length, 2);
  assert.equal(inserts.some(({ table }) => table === "studyParticipants"), false);
  assert.deepEqual(patches, [{ id: "study-1", value: { status: "participants_under_review", updatedAt: 1_000 } }]);
});

test("revalidates editable review rows and batch counts after a correction", async (context) => {
  context.mock.method(Date, "now", () => 2_000);
  const firstRow = {
    _id: "row-1",
    organizationId: "org-1",
    studyId: "study-1",
    batchId: "batch-1",
    rowNumber: 2,
    raw: { Name: "Needs email", Email: "" },
    normalized: { name: "Needs email" },
    issues: ["Add a valid email address or phone number"],
    duplicate: false,
    suppressed: false,
    disposition: "needs_review",
    createdAt: 1_000,
    updatedAt: 1_000,
  };
  const secondRow = {
    ...firstRow,
    _id: "row-2",
    rowNumber: 3,
    raw: { Name: "Already valid", Email: "valid@example.com" },
    normalized: { name: "Already valid", email: "valid@example.com", preferredMode: "form" },
    issues: [],
    disposition: "ready",
  };
  const { ctx, patches } = storedImportContext([firstRow, secondRow]);

  const result = await invoke(updateRow, ctx, {
    rowId: "row-1",
    normalized: {
      name: "Needs email",
      email: "fixed@example.com",
      preferredMode: "form",
    },
  });

  assert.equal(result.disposition, "ready");
  assert.deepEqual(result.issues, []);
  assert.ok(patches.some(({ id, value }) =>
    id === "row-1" && value.disposition === "ready" &&
    (value.normalized as { email?: string }).email === "fixed@example.com"
  ));
  assert.ok(patches.some(({ id, value }) =>
    id === "batch-1" && value.validRows === 2 && value.invalidRows === 0
  ));
});

test("lets a reviewer explicitly exclude an unresolved row", async (context) => {
  context.mock.method(Date, "now", () => 2_000);
  const unresolved = {
    _id: "row-1",
    organizationId: "org-1",
    studyId: "study-1",
    batchId: "batch-1",
    rowNumber: 2,
    raw: { Name: "No contact", Email: "" },
    normalized: { name: "No contact" },
    issues: ["Add a valid email address or phone number"],
    duplicate: false,
    suppressed: false,
    disposition: "needs_review",
    createdAt: 1_000,
    updatedAt: 1_000,
  };
  const { ctx, patches } = storedImportContext([unresolved]);

  const result = await invoke(updateRow, ctx, {
    rowId: "row-1",
    normalized: unresolved.normalized,
    exclude: true,
  });

  assert.equal(result.disposition, "excluded");
  assert.ok(patches.some(({ id, value }) => id === "row-1" && value.disposition === "excluded"));
  assert.ok(patches.some(({ id, value }) =>
    id === "batch-1" && value.validRows === 0 && value.invalidRows === 0
  ));
});

test("removes an excluded row from within-file duplicate evaluation", async (context) => {
  context.mock.method(Date, "now", () => 2_000);
  const duplicate = {
    _id: "row-1",
    organizationId: "org-1",
    studyId: "study-1",
    batchId: "batch-1",
    rowNumber: 2,
    raw: { Name: "First", Email: "dupe@example.com" },
    normalized: { name: "First", email: "dupe@example.com", preferredMode: "form" },
    issues: ["Duplicate contact in this import"],
    duplicate: true,
    suppressed: false,
    disposition: "needs_review",
    createdAt: 1_000,
    updatedAt: 1_000,
  };
  const other = {
    ...duplicate,
    _id: "row-2",
    rowNumber: 3,
    normalized: { name: "Second", email: "dupe@example.com", preferredMode: "form" },
  };
  const { ctx, patches } = storedImportContext([duplicate, other]);

  await invoke(updateRow, ctx, {
    rowId: "row-1",
    normalized: duplicate.normalized,
    exclude: true,
  });

  assert.ok(patches.some(({ id, value }) =>
    id === "row-2" && value.disposition === "ready" && value.duplicate === false
  ));
});

test("materializes only reviewed ready rows after explicit batch approval", async (context) => {
  context.mock.method(Date, "now", () => 3_000);
  const readyRow = {
    _id: "row-1",
    organizationId: "org-1",
    studyId: "study-1",
    batchId: "batch-1",
    rowNumber: 2,
    raw: {
      Name: "Approved Person",
      Email: "approved@example.com",
      Notes: "Requested a morning interview",
    },
    normalized: {
      name: "Approved Person",
      email: "approved@example.com",
      segment: "Enterprise",
      preferredMode: "form",
    },
    issues: [],
    duplicate: false,
    suppressed: false,
    disposition: "ready",
    createdAt: 1_000,
    updatedAt: 1_000,
  };
  const excludedRow = {
    ...readyRow,
    _id: "row-2",
    rowNumber: 3,
    normalized: { name: "Suppressed", email: "suppressed@example.com", preferredMode: "form" },
    issues: ["Contact is suppressed for this workspace"],
    suppressed: true,
    disposition: "excluded",
  };
  const { ctx, inserts, patches } = storedImportContext([readyRow, excludedRow]);

  const result = await invoke(approveImport, ctx, { batchId: "batch-1" });

  assert.equal(result.created, true);
  assert.equal(result.participantIds.length, 1);
  const participants = inserts.filter(({ table }) => table === "studyParticipants");
  assert.equal(participants.length, 1);
  assert.deepEqual(participants[0].value, {
    organizationId: "org-1",
    studyId: "study-1",
    name: "Approved Person",
    email: "approved@example.com",
    phone: undefined,
    segment: "Enterprise",
    notes: "Requested a morning interview",
    preferredMode: "form",
    consentStatus: "unknown",
    importBatchId: "batch-1",
    status: "draft",
    createdBy: "user-1",
    createdAt: 3_000,
    updatedAt: 3_000,
  });
  assert.ok(patches.some(({ id, value }) =>
    id === "batch-1" && value.status === "approved" && value.approvedBy === "user-1"
  ));
  assert.ok(patches.some(({ id, value }) =>
    id === "study-1" && value.status === "fieldwork_ready"
  ));
  assert.ok(patches.some(({ id, value }) =>
    id === "study-1" && value.currentApprovedParticipantBatchId === "batch-1"
  ));
});

test("wraps manually added participants in an approved synthetic batch", async (context) => {
  context.mock.method(Date, "now", () => 4_000);
  const participant = {
    _id: "participant-1",
    organizationId: "org-1",
    studyId: "study-1",
    name: "Manual Person",
    email: "manual@example.com",
    preferredMode: "form",
    status: "draft",
  };
  const { ctx, inserts, patches } = manualSelectionContext([participant]);

  const result = await invoke(approveManualSelection, ctx, {
    studyId: "study-1",
    participantIds: ["participant-1"],
  });

  assert.equal(result.created, true);
  assert.equal(result.batchId, "participantImportBatches-1");
  const batch = inserts.find(({ table }) => table === "participantImportBatches");
  assert.deepEqual(batch?.value, {
    organizationId: "org-1",
    studyId: "study-1",
    filename: "Manual selection",
    mapping: { source: "manual_selection" },
    totalRows: 1,
    validRows: 1,
    invalidRows: 0,
    duplicateRows: 0,
    suppressedRows: 0,
    status: "approved",
    approvedBy: "user-1",
    approvedAt: 4_000,
    createdAt: 4_000,
    updatedAt: 4_000,
  });
  assert.ok(patches.some(({ id, value }) =>
    id === "participant-1" && value.importBatchId === "participantImportBatches-1"
  ));
  assert.ok(patches.some(({ id, value }) =>
    id === "study-1" && value.currentApprovedParticipantBatchId === "participantImportBatches-1"
  ));
  assert.ok(patches.some(({ id, value }) => id === "study-1" && value.status === "fieldwork_ready"));
});

test("adds a manual participant to the approved batch while fieldwork is running", async (context) => {
  context.mock.method(Date, "now", () => 5_000);
  const participant = {
    _id: "participant-2",
    organizationId: "org-1",
    studyId: "study-1",
    name: "Late Manual Person",
    phone: "+919876543210",
    preferredMode: "voice",
    status: "draft",
  };
  const currentBatch = {
    _id: "batch-current",
    organizationId: "org-1",
    studyId: "study-1",
    status: "approved",
    totalRows: 2,
    validRows: 2,
  };
  const { ctx, inserts, patches } = manualSelectionContext([participant], {
    _id: "study-1",
    organizationId: "org-1",
    status: "fieldwork_running",
    currentApprovedParticipantBatchId: "batch-current",
  }, currentBatch);

  const result = await invoke(approveManualSelection, ctx, {
    studyId: "study-1",
    participantIds: ["participant-2"],
  });

  assert.equal(result.created, false);
  assert.equal(result.batchId, "batch-current");
  assert.equal(inserts.some(({ table }) => table === "participantImportBatches"), false);
  assert.ok(patches.some(({ id, value }) =>
    id === "batch-current" && value.totalRows === 3 && value.validRows === 3
  ));
  assert.ok(patches.some(({ id, value }) =>
    id === "participant-2" && value.importBatchId === "batch-current"
  ));
});

const emptyContactPolicy = {
  async findExisting() {
    return { emails: [], phones: [] };
  },
  async findSuppressed() {
    return { emails: [], phones: [] };
  },
};

function participantImportContext({
  inserts,
  patches,
}: {
  inserts: Array<{ table: string; value: Record<string, unknown> }>;
  patches: Array<{ id: string; value: Record<string, unknown> }>;
}) {
  let nextId = 0;
  return {
    auth: {
      getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }),
    },
    db: {
      get: async (id: string) => id === "study-1"
        ? { _id: "study-1", organizationId: "org-1", status: "questionnaire_approved" }
        : null,
      query: (table: string) => ({
        withIndex: () => ({
          unique: async () => {
            if (table === "users") return { _id: "user-1", defaultOrganizationId: "org-1" };
            if (table === "memberships") return { _id: "membership-1" };
            return null;
          },
          collect: async () => [],
        }),
      }),
      insert: async (table: string, value: Record<string, unknown>) => {
        inserts.push({ table, value });
        return `${table}-${++nextId}`;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        patches.push({ id, value });
      },
    },
  };
}

type TestRecord = Record<string, unknown>;

function storedImportContext(rows: TestRecord[]) {
  const patches: Array<{ id: string; value: TestRecord }> = [];
  const inserts: Array<{ table: string; value: TestRecord }> = [];
  const documents = new Map<string, TestRecord>([
    ["study-1", { _id: "study-1", organizationId: "org-1", status: "participants_under_review" }],
    ["batch-1", {
      _id: "batch-1",
      organizationId: "org-1",
      studyId: "study-1",
      status: "under_review",
      mapping: { name: ["Name"], email: ["Email"], notes: ["Notes"] },
    }],
    ...rows.map((row) => [String(row._id), row] as const),
  ]);
  return {
    patches,
    inserts,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }) },
      db: {
        get: async (id: string) => documents.get(id) ?? null,
        query: (table: string) => ({
          withIndex: () => ({
            unique: async () => {
              if (table === "users") return { _id: "user-1", defaultOrganizationId: "org-1" };
              if (table === "memberships") return { _id: "membership-1" };
              return null;
            },
            collect: async () => table === "participantImportRows" ? rows : [],
          }),
        }),
        patch: async (id: string, value: TestRecord) => {
          patches.push({ id, value });
          documents.set(id, { ...documents.get(id), ...value });
        },
        insert: async (table: string, value: TestRecord) => {
          inserts.push({ table, value });
          return `${table}-${inserts.length}`;
        },
      },
    },
  };
}

function manualSelectionContext(
  participants: TestRecord[],
  study: TestRecord = { _id: "study-1", organizationId: "org-1", status: "questionnaire_approved" },
  currentBatch?: TestRecord,
) {
  const inserts: Array<{ table: string; value: TestRecord }> = [];
  const patches: Array<{ id: string; value: TestRecord }> = [];
  const documents = new Map<string, TestRecord>([
    ["study-1", study],
    ...(currentBatch ? [[String(currentBatch._id), currentBatch] as const] : []),
    ...participants.map((participant) => [String(participant._id), participant] as const),
  ]);
  return {
    inserts,
    patches,
    ctx: {
      auth: { getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }) },
      db: {
        get: async (id: string) => documents.get(id) ?? null,
        query: (table: string) => ({
          withIndex: () => ({
            unique: async () => {
              if (table === "users") return { _id: "user-1", defaultOrganizationId: "org-1" };
              if (table === "memberships") return { _id: "membership-1" };
              return null;
            },
            collect: async () => table === "suppressionEntries" ? [] : participants,
          }),
        }),
        insert: async (table: string, value: TestRecord) => {
          inserts.push({ table, value });
          return `${table}-${inserts.filter((entry) => entry.table === table).length}`;
        },
        patch: async (id: string, value: TestRecord) => {
          patches.push({ id, value });
          documents.set(id, { ...documents.get(id), ...value });
        },
      },
    },
  };
}

async function invoke(
  endpoint: unknown,
  ctx: unknown,
  args: unknown,
) {
  return (endpoint as {
    _handler: (context: unknown, input: unknown) => Promise<ImportTestResult>;
  })._handler(ctx, args);
}

async function invokeMapping(endpoint: unknown, ctx: unknown, args: unknown) {
  return (endpoint as {
    _handler: (context: unknown, input: unknown) => Promise<{
      mapping: Record<string, string[]>;
    }>;
  })._handler(ctx, args);
}

type ImportTestResult = {
  counts: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    suppressedRows: number;
  };
  disposition: string;
  issues: string[];
  created: boolean;
  participantIds: string[];
  batchId: string;
};
