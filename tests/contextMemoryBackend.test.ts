import assert from "node:assert/strict";
import test from "node:test";

import * as companyMemory from "../convex/companyMemory";
import * as studyMemory from "../convex/studyMemory";

const handler = <TArgs, TResult>(value: unknown) =>
  (value as { _handler: (ctx: unknown, args: TArgs) => Promise<TResult> })._handler;

function memoryContext({ membership = true } = {}) {
  const tables = {
    organizationMemories: new Map<string, Record<string, unknown>>(),
    studyMemories: new Map<string, Record<string, unknown>>(),
    studies: new Map<string, Record<string, unknown>>([
      ["study-1", { _id: "study-1", organizationId: "organization-1" }],
      ["study-2", { _id: "study-2", organizationId: "organization-2" }],
    ]),
  };
  const inserted: Array<{ table: string; value: Record<string, unknown> }> = [];
  const patched: Array<{ id: string; value: Record<string, unknown> }> = [];

  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }) },
    db: {
      get: async (id: string) => {
        for (const table of Object.values(tables)) {
          const value = table.get(id);
          if (value) return value;
        }
        return null;
      },
      insert: async (tableName: keyof typeof tables, value: Record<string, unknown>) => {
        const id = `${tableName}-${inserted.length + 1}`;
        const record = { _id: id, ...value };
        tables[tableName].set(id, record);
        inserted.push({ table: tableName, value });
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        for (const table of Object.values(tables)) {
          const current = table.get(id);
          if (current) table.set(id, { ...current, ...value });
        }
        patched.push({ id, value });
      },
      query: (tableName: string) => ({
        withIndex: (_index: string, apply?: (query: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
          apply?.({ eq: () => ({ eq: () => undefined }) });
          const records = tableName in tables
            ? Array.from(tables[tableName as keyof typeof tables].values())
            : [];
          return {
            unique: async () => {
              if (tableName === "users") return { _id: "user-1", defaultOrganizationId: "organization-1" };
              if (tableName === "memberships") return membership ? { _id: "membership-1", organizationId: "organization-1", userId: "user-1" } : null;
              return records[0] ?? null;
            },
            order: () => ({ collect: async () => records }),
            collect: async () => records,
          };
        },
      }),
    },
  };

  return { ctx, tables, inserted, patched };
}

test("company memory create and edit keep the persisted record intentionally simple", async () => {
  const { ctx, tables, inserted, patched } = memoryContext();
  const memoryId = await handler<{ key: string; value: string; category: "product" }, string>(companyMemory.create)(ctx, {
    key: "  Pricing model ",
    value: " Annual contracts start at 20 seats. ",
    category: "product",
  });

  await handler<{ memoryId: string; key: string; value: string; category: "company" }, void>(companyMemory.update)(ctx, {
    memoryId,
    key: "Commercial model",
    value: "Annual contracts start at 25 seats.",
    category: "company",
  });

  assert.deepEqual(Object.keys(inserted[0]?.value ?? {}).sort(), [
    "category",
    "createdAt",
    "key",
    "organizationId",
    "status",
    "updatedAt",
    "value",
  ]);
  assert.equal(tables.organizationMemories.get(memoryId)?.key, "Commercial model");
  assert.equal(tables.organizationMemories.get(memoryId)?.value, "Annual contracts start at 25 seats.");
  assert.equal(patched[0]?.id, memoryId);
});

test("company memory requires an active membership in the default workspace", async () => {
  const { ctx } = memoryContext({ membership: false });
  await assert.rejects(
    () => handler<Record<string, never>, unknown>(companyMemory.list)(ctx, {}),
    /Workspace not found/,
  );
});

test("company memory upsert revives a matching key and archive hides it from active lists", async () => {
  const { ctx, tables } = memoryContext();
  tables.organizationMemories.set("memory-1", {
    _id: "memory-1",
    organizationId: "organization-1",
    key: "Target customer",
    value: "Early-stage teams",
    category: "customer",
    status: "archived",
    createdAt: 1,
    updatedAt: 1,
  });
  tables.organizationMemories.set("foreign-memory", {
    _id: "foreign-memory",
    organizationId: "organization-2",
    key: "Private fact",
    value: "Do not expose",
    category: "other",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });

  const memoryId = await handler<{ key: string; value: string; category: "customer" }, string>(companyMemory.upsert)(ctx, {
    key: " target CUSTOMER ",
    value: "10–200 seat teams",
    category: "customer",
  });
  const active = await handler<Record<string, never>, Array<{ _id: string }>>(companyMemory.list)(ctx, {});
  await handler<{ memoryId: string }, void>(companyMemory.archive)(ctx, { memoryId: "memory-1" });

  assert.equal(memoryId, "memory-1");
  assert.equal(tables.organizationMemories.get("memory-1")?.status, "archived");
  assert.deepEqual(active.map((item) => item._id), ["memory-1"]);
  await assert.rejects(
    () => handler<{ memoryId: string }, void>(companyMemory.archive)(ctx, { memoryId: "foreign-memory" }),
    /Memory not found/,
  );
});

test("study memory CRUD and upsert remain isolated to an authorized study", async () => {
  const { ctx, tables } = memoryContext();
  tables.studyMemories.set("study-memory-1", {
    _id: "study-memory-1",
    organizationId: "organization-1",
    studyId: "study-1",
    key: "Decision",
    value: "Improve onboarding",
    category: "decision",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  });

  const createdId = await handler<{ studyId: string; key: string; value: string; category: "hypothesis" }, string>(studyMemory.create)(ctx, {
    studyId: "study-1",
    key: "Retention hypothesis",
    value: "Setup time drives early churn",
    category: "hypothesis",
  });
  const upsertedId = await handler<{ studyId: string; key: string; value: string; category: "decision" }, string>(studyMemory.upsert)(ctx, {
    studyId: "study-1",
    key: " decision ",
    value: "Improve onboarding before Q3",
    category: "decision",
  });
  await handler<{ memoryId: string; value: string }, void>(studyMemory.update)(ctx, {
    memoryId: createdId,
    value: "Setup time and unclear value drive early churn",
  });
  const active = await handler<{ studyId: string }, Array<{ _id: string }>>(studyMemory.list)(ctx, { studyId: "study-1" });
  await handler<{ memoryId: string }, void>(studyMemory.archive)(ctx, { memoryId: createdId });

  assert.equal(upsertedId, "study-memory-1");
  assert.equal(tables.studyMemories.get("study-memory-1")?.value, "Improve onboarding before Q3");
  assert.deepEqual(new Set(active.map((item) => item._id)), new Set(["study-memory-1", createdId]));
  assert.equal(tables.studyMemories.get(createdId)?.status, "archived");
  await assert.rejects(
    () => handler<{ studyId: string }, unknown>(studyMemory.list)(ctx, { studyId: "study-2" }),
    /Workspace not found/,
  );
});

test("memory mutations reject blank labels or values", async () => {
  const { ctx } = memoryContext();
  await assert.rejects(
    () => handler<{ key: string; value: string; category: "other" }, unknown>(companyMemory.create)(ctx, { key: " ", value: "Fact", category: "other" }),
    /key and value are required/i,
  );
  await assert.rejects(
    () => handler<{ studyId: string; key: string; value: string; category: "other" }, unknown>(studyMemory.create)(ctx, { studyId: "study-1", key: "Fact", value: " ", category: "other" }),
    /key and value are required/i,
  );
});

test("trusted context jobs can upsert company and study memory without user-only metadata", async () => {
  const { ctx, tables } = memoryContext();
  const companyId = await handler<{ organizationId: string; key: string; value: string; category: "company" }, string>(companyMemory.upsertFromAgent)(ctx, {
    organizationId: "organization-1",
    key: "Positioning",
    value: "Evidence-led research operations",
    category: "company",
  });
  const studyId = await handler<{ organizationId: string; studyId: string; key: string; value: string; category: "hypothesis" }, string>(studyMemory.upsertFromAgent)(ctx, {
    organizationId: "organization-1",
    studyId: "study-1",
    key: "Activation hypothesis",
    value: "Guided setup improves activation",
    category: "hypothesis",
  });

  assert.deepEqual(Object.keys(tables.organizationMemories.get(companyId) ?? {}).sort(), [
    "_id", "category", "createdAt", "key", "organizationId", "status", "updatedAt", "value",
  ]);
  assert.equal(tables.studyMemories.get(studyId)?.organizationId, "organization-1");
  await assert.rejects(
    () => handler<{ organizationId: string; studyId: string; key: string; value: string; category: "other" }, unknown>(studyMemory.upsertFromAgent)(ctx, {
      organizationId: "organization-1",
      studyId: "study-2",
      key: "Foreign",
      value: "Must be rejected",
      category: "other",
    }),
    /Study not found/,
  );
});
