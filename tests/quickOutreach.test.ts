import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as outreachBatches from "../convex/outreachBatches";

test("confirmed email outreach prepares and approves a manual participant atomically", async (context) => {
  context.mock.method(Date, "now", () => 5_000);
  const fixture = quickOutreachContext();
  const result = await invokePrepare(fixture.ctx, {
    participantId: "participant-1",
    channel: "email",
    confirmed: true,
  });

  assert.equal(result.reused, false);
  const participantBatch = fixture.inserts.find(({ table }) => table === "participantImportBatches");
  const outreach = fixture.inserts.find(({ table }) => table === "outreachBatches");
  assert.ok(participantBatch);
  assert.ok(outreach);
  assert.equal(outreach.value.status, "running");
  assert.deepEqual(outreach.value.channels, ["email"]);
  assert.ok(fixture.patches.some(({ id, value }) => id === "participant-1" && value.importBatchId));
  assert.ok(fixture.patches.some(({ id, value }) => id === "study-1" && value.status === "fieldwork_running"));
});

test("quick outreach rejects a channel without participant contact", async () => {
  const fixture = quickOutreachContext();
  await assert.rejects(
    invokePrepare(fixture.ctx, {
      participantId: "participant-1",
      channel: "voice",
      confirmed: true,
    }),
    /phone number/i,
  );
});

test("quick outreach reuses a compatible running batch on retry", async () => {
  const fixture = quickOutreachContext({ withRunningBatch: true });
  const result = await invokePrepare(fixture.ctx, {
    participantId: "participant-1",
    channel: "email",
    confirmed: true,
  });

  assert.deepEqual(result, { outreachBatchId: "outreach-1", reused: true });
  assert.equal(fixture.inserts.some(({ table }) => table === "outreachBatches"), false);
});

test("outbound provider configuration is documented by name", async () => {
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  for (const name of [
    "MERIDIAN_APP_URL",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "ELEVENLABS_PHONE_NUMBER_ID",
  ]) {
    assert.match(envExample, new RegExp(`^${name}=`, "m"));
  }
});

async function invokePrepare(ctx: unknown, args: unknown) {
  const endpoint = (outreachBatches as unknown as {
    prepareSingleParticipant?: { _handler: (context: unknown, input: unknown) => Promise<{ outreachBatchId: string; reused: boolean }> };
  }).prepareSingleParticipant;
  assert.ok(endpoint, "outreachBatches.prepareSingleParticipant must exist");
  return endpoint._handler(ctx, args);
}

function quickOutreachContext(options: { withRunningBatch?: boolean } = {}) {
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const patches: Array<{ id: string; value: Record<string, unknown> }> = [];
  const participantBatch = options.withRunningBatch
    ? { _id: "participant-batch-1", organizationId: "org-1", studyId: "study-1", status: "approved" }
    : null;
  const participant = {
    _id: "participant-1",
    organizationId: "org-1",
    studyId: "study-1",
    name: "Test Participant",
    email: "participant@example.com",
    preferredMode: "either",
    consentStatus: "unknown",
    status: "draft",
    importBatchId: participantBatch?._id,
  };
  const study = {
    _id: "study-1",
    organizationId: "org-1",
    currentStudyPlanVersionId: "plan-1",
    currentInterviewBriefVersionId: "guide-1",
    currentApprovedParticipantBatchId: participantBatch?._id,
    status: options.withRunningBatch ? "fieldwork_running" : "questionnaire_approved",
  };
  const runningBatch = options.withRunningBatch
    ? {
        _id: "outreach-1",
        organizationId: "org-1",
        studyId: "study-1",
        questionnaireVersionId: "guide-1",
        participantBatchId: "participant-batch-1",
        participantIds: ["participant-1"],
        channels: ["email"],
        status: "running",
      }
    : null;
  const documents = new Map<string, Record<string, unknown>>([
    ["participant-1", participant],
    ["study-1", study],
    ["plan-1", { _id: "plan-1", studyId: "study-1", status: "approved" }],
    ["guide-1", { _id: "guide-1", studyId: "study-1", status: "approved" }],
    ...(participantBatch ? [[participantBatch._id, participantBatch] as const] : []),
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
            collect: async () => {
              if (table === "suppressionEntries") return [];
              if (table === "outreachBatches") return runningBatch ? [runningBatch] : [];
              return [];
            },
          }),
        }),
        insert: async (table: string, value: Record<string, unknown>) => {
          inserts.push({ table, value });
          const id = table === "participantImportBatches" ? "participant-batch-new" : `${table}-${inserts.length}`;
          documents.set(id, { _id: id, ...value });
          return id;
        },
        patch: async (id: string, value: Record<string, unknown>) => {
          patches.push({ id, value });
          documents.set(id, { ...documents.get(id), ...value });
        },
      },
    },
  };
}
