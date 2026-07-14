import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyKnowledgeUpload,
  normalizePublicKnowledgeLink,
  requireSourceStatusTransition,
} from "../convex/knowledgeActions";
import { generateUploadUrl, list, remove, retry, submitLink, submitUpload } from "../convex/knowledge";

const handler = <TArgs, TResult>(value: unknown) =>
  (value as { _handler: (ctx: unknown, args: TArgs) => Promise<TResult> })._handler;

function companyContext({ membership = true } = {}) {
  const inserted: Array<{ table: string; value: Record<string, unknown> }> = [];
  const patched: Array<{ id: string; value: Record<string, unknown> }> = [];
  const deleted: string[] = [];
  const sources = new Map<string, Record<string, unknown>>();
  const scheduled: Array<{ delay: number; args: Record<string, unknown> }> = [];

  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }) },
    storage: { generateUploadUrl: async () => "https://upload.example.test/token" },
    scheduler: { runAfter: async (delay: number, _fn: unknown, args: Record<string, unknown>) => { scheduled.push({ delay, args }); } },
    db: {
      get: async (id: string) => id === "study-1"
        ? { _id: "study-1", organizationId: "organization-1" }
        : sources.get(id) ?? null,
      insert: async (table: string, value: Record<string, unknown>) => {
        inserted.push({ table, value });
        return `${table}-${inserted.length}`;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        patched.push({ id, value });
      },
      delete: async (id: string) => { deleted.push(id); },
      query: (table: string) => ({
        withIndex: (_index: string, apply?: (query: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
          apply?.({ eq: () => ({ eq: () => undefined }) });
          return {
            unique: async () => {
              if (table === "users") return { _id: "user-1", defaultOrganizationId: "organization-1" };
              if (table === "memberships") return membership ? { _id: "membership-1", organizationId: "organization-1", userId: "user-1" } : null;
              return null;
            },
            order: () => ({ collect: async () => Array.from(sources.values()) }),
            collect: async () => Array.from(sources.values()),
          };
        },
      }),
    },
  };

  return { ctx, inserted, patched, deleted, sources, scheduled };
}

test("knowledge submissions accept public links and supported v1 file kinds", () => {
  assert.deepEqual(normalizePublicKnowledgeLink("website", "northbeam.co"), {
    kind: "website",
    url: "https://northbeam.co/",
  });
  assert.deepEqual(normalizePublicKnowledgeLink("public_media", "https://youtube.com/watch?v=abc"), {
    kind: "public_media",
    url: "https://youtube.com/watch?v=abc",
  });
  assert.equal(classifyKnowledgeUpload("research.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "spreadsheet");
  assert.equal(classifyKnowledgeUpload("brief.pdf", "application/pdf"), "document");
  assert.equal(classifyKnowledgeUpload("call.m4a", "audio/mp4"), "audio");
  assert.throws(() => classifyKnowledgeUpload("payload.exe", "application/octet-stream"), /supported document, spreadsheet, audio, or video/i);
  assert.throws(() => normalizePublicKnowledgeLink("website", "http://localhost:3000"), /public URL/i);
});

test("company knowledge requires an active membership in the default workspace", async () => {
  const { ctx } = companyContext({ membership: false });
  await assert.rejects(
    () => handler<{ kind: "website"; url: string }, unknown>(submitLink)(ctx, { kind: "website", url: "northbeam.co" }),
    /Workspace not found/,
  );
});

test("knowledge status transitions reject skipped or ambiguous processing states", () => {
  assert.doesNotThrow(() => requireSourceStatusTransition("queued", "processing"));
  assert.doesNotThrow(() => requireSourceStatusTransition("processing", "ready", { summary: "12 pages indexed" }));
  assert.doesNotThrow(() => requireSourceStatusTransition("processing", "failed", { error: "The document could not be read." }));
  assert.doesNotThrow(() => requireSourceStatusTransition("failed", "queued"));
  assert.throws(() => requireSourceStatusTransition("queued", "ready", { summary: "Skipped" }), /cannot move/i);
  assert.throws(() => requireSourceStatusTransition("processing", "failed"), /user-readable error/i);
});

test("knowledge mutations create queued sources and schedule processing", async () => {
  const { ctx, inserted, scheduled } = companyContext();

  const linkId = await handler<{ kind: "website"; url: string }, string>(submitLink)(ctx, {
    kind: "website",
    url: "northbeam.co",
  });
  const uploadId = await handler<{ storageId: string; filename: string; contentType: string }, string>(submitUpload)(ctx, {
    storageId: "storage-1",
    filename: "research.csv",
    contentType: "text/csv",
  });
  const uploadUrl = await handler<Record<string, never>, string>(generateUploadUrl)(ctx, {});

  assert.equal(linkId, "knowledgeSources-1");
  assert.equal(uploadId, "knowledgeSources-2");
  assert.equal(uploadUrl, "https://upload.example.test/token");
  assert.deepEqual(inserted.map((entry) => ({
    table: entry.table,
    organizationId: entry.value.organizationId,
    studyId: entry.value.studyId,
    kind: entry.value.kind,
    status: entry.value.status,
  })), [
    { table: "knowledgeSources", organizationId: "organization-1", studyId: undefined, kind: "website", status: "queued" },
    { table: "knowledgeSources", organizationId: "organization-1", studyId: undefined, kind: "spreadsheet", status: "queued" },
  ]);
  assert.deepEqual(scheduled, [
    { delay: 0, args: { sourceId: "knowledgeSources-1" } },
    { delay: 0, args: { sourceId: "knowledgeSources-2" } },
  ]);
});

test("knowledge list, retry, and removal stay inside the current workspace", async () => {
  const { ctx, sources, patched, deleted, scheduled } = companyContext();
  sources.set("company-source", {
    _id: "company-source",
    organizationId: "organization-1",
    status: "failed",
    error: "Could not read the file.",
    updatedAt: 1,
  });
  sources.set("study-source", {
    _id: "study-source",
    organizationId: "organization-1",
    studyId: "study-1",
    status: "ready",
    updatedAt: 2,
  });
  sources.set("foreign-source", {
    _id: "foreign-source",
    organizationId: "organization-2",
    status: "failed",
    updatedAt: 3,
  });

  const companySources = await handler<Record<string, never>, Array<{ _id: string }>>(list)(ctx, {});
  const studySources = await handler<{ studyId: string }, Array<{ _id: string }>>(list)(ctx, { studyId: "study-1" });
  await handler<{ sourceId: string }, void>(retry)(ctx, { sourceId: "company-source" });
  await handler<{ sourceId: string }, void>(remove)(ctx, { sourceId: "company-source" });

  assert.deepEqual(companySources.map((source) => source._id), ["company-source"]);
  assert.deepEqual(studySources.map((source) => source._id), ["study-source"]);
  assert.deepEqual(patched[0], { id: "company-source", value: { status: "queued", error: undefined, extractedSummary: undefined, updatedAt: patched[0]?.value.updatedAt } });
  assert.deepEqual(scheduled, [{ delay: 0, args: { sourceId: "company-source" } }]);
  assert.deepEqual(deleted, ["company-source"]);
  await assert.rejects(
    () => handler<{ sourceId: string }, void>(retry)(ctx, { sourceId: "foreign-source" }),
    /Source not found/,
  );
});
