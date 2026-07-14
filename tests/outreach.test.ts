import assert from "node:assert/strict";
import test from "node:test";

import { assertOutreachDraft, assertOutreachLaunch } from "../convex/lib/outreach";
import * as outreachBatches from "../convex/outreachBatches";

const ready = {
  studyStatus: "fieldwork_ready",
  questionnaireStatus: "approved",
  participantBatchStatus: "approved",
  participantCount: 2,
  channels: ["email"] as const,
};

test("outreach drafts require approved research inputs", () => {
  assert.doesNotThrow(() => assertOutreachDraft(ready));
  assert.doesNotThrow(() =>
    assertOutreachDraft({ ...ready, participantBatchStatus: undefined }),
  );
  assert.throws(
    () => assertOutreachDraft({ ...ready, questionnaireStatus: "awaiting_approval" }),
    /questionnaire/i,
  );
  assert.throws(
    () => assertOutreachDraft({ ...ready, participantBatchStatus: "under_review" }),
    /participant batch/i,
  );
  assert.throws(
    () => assertOutreachDraft({ ...ready, participantCount: 0 }),
    /participant/i,
  );
});

test("outreach cannot launch until the exact batch is approved", () => {
  assert.doesNotThrow(() =>
    assertOutreachLaunch({ studyStatus: "fieldwork_ready", outreachStatus: "approved" }),
  );
  assert.throws(
    () => assertOutreachLaunch({ studyStatus: "fieldwork_ready", outreachStatus: "awaiting_approval" }),
    /approved/i,
  );
  assert.throws(
    () => assertOutreachLaunch({ studyStatus: "fieldwork_running", outreachStatus: "approved" }),
    /fieldwork/i,
  );
});

test("outreach exposes an explicit draft, approval, and launch boundary", () => {
  assert.ok("createDraft" in outreachBatches);
  assert.ok("submitForApproval" in outreachBatches);
  assert.ok("approve" in outreachBatches);
  assert.ok("launch" in outreachBatches);
});
