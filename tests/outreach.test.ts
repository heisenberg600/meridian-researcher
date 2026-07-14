import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDeliveryGate,
  assertOutreachDelivery,
  assertOutreachDraft,
  assertOutreachLaunch,
  createApprovedSnapshot,
  creditReservationForDelivery,
  deliveryIdempotencyKey,
  nextParticipantStatus,
  planDeliveryRetry,
} from "../convex/lib/outreach";
import * as outreachBatches from "../convex/outreachBatches";

const ready = {
  studyStatus: "fieldwork_ready",
  planStatus: "approved",
  questionnaireStatus: "approved",
  participantBatchStatus: "approved",
  participantCount: 2,
  channels: ["email"] as const,
};

test("outreach drafts require approved research inputs", () => {
  assert.doesNotThrow(() => assertOutreachDraft(ready));
  assert.doesNotThrow(() => assertOutreachDraft({ ...ready, studyStatus: "fieldwork_running" }));
  assert.doesNotThrow(() =>
    assertOutreachDraft({ ...ready, participantBatchStatus: undefined }),
  );
  assert.throws(
    () => assertOutreachDraft({ ...ready, planStatus: "awaiting_approval" }),
    /plan/i,
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

test("approval freezes the exact plan, questionnaire, import, participants, and channels", () => {
  const snapshot = createApprovedSnapshot({
    studyPlanVersionId: "plan-v3",
    questionnaireVersionId: "guide-v4",
    participantBatchId: "import-v2",
    requestedChannels: ["email", "voice", "email"],
    participants: [
      { id: "participant-a", email: "a@example.com", phone: "+14155550100" },
      { id: "participant-b", email: "b@example.com" },
    ],
  });

  assert.deepEqual(snapshot, {
    studyPlanVersionId: "plan-v3",
    questionnaireVersionId: "guide-v4",
    participantBatchId: "import-v2",
    recipients: [
      { participantId: "participant-a", channels: ["email", "voice"] },
      { participantId: "participant-b", channels: ["email"] },
    ],
  });
});

test("the last pre-provider gate blocks suppression and every declined state", () => {
  const allowed = {
    outreachStatus: "running",
    snapshotMatches: true,
    participantStatus: "invited",
    consentStatus: "pending",
    suppressed: false,
  };
  assert.doesNotThrow(() => assertDeliveryGate(allowed));
  assert.throws(() => assertDeliveryGate({ ...allowed, suppressed: true }), /suppressed/i);
  assert.throws(
    () => assertDeliveryGate({ ...allowed, participantStatus: "declined" }),
    /declined/i,
  );
  assert.throws(
    () => assertDeliveryGate({ ...allowed, consentStatus: "declined" }),
    /consent/i,
  );
});

test("delivery retries keep a stable provider key and never duplicate accepted or ambiguous voice calls", () => {
  assert.equal(
    deliveryIdempotencyKey("batch-1", "participant-a", "email"),
    "outreach/batch-1/participant-a/email",
  );
  assert.equal(planDeliveryRetry({ channel: "email", status: "failed", retrySafe: true }), "dispatch");
  assert.equal(planDeliveryRetry({ channel: "email", status: "accepted", retrySafe: true }), "skip");
  assert.equal(planDeliveryRetry({ channel: "voice", status: "unknown", retrySafe: false }), "manual_review");
});

test("each delivery reserves its maximum and reconciles only measured provider acceptance", () => {
  assert.deepEqual(creditReservationForDelivery({ channel: "email", estimatedMinutes: 12 }), {
    operation: "email_delivery",
    maximumCredits: 2,
    measuredNativeQuantity: 1,
  });
  assert.deepEqual(creditReservationForDelivery({ channel: "voice", estimatedMinutes: 12 }), {
    operation: "connected_voice",
    maximumCredits: 14_400,
    measuredNativeQuantity: 720,
  });
});

test("participant lifecycle covers open, consent, start, completion, failure, and decline", () => {
  assert.equal(nextParticipantStatus("invited", "invite_opened"), "opened");
  assert.equal(nextParticipantStatus("opened", "consent_granted"), "opened");
  assert.equal(nextParticipantStatus("opened", "interview_started"), "started");
  assert.equal(nextParticipantStatus("started", "interview_completed"), "completed");
  assert.equal(nextParticipantStatus("started", "interview_failed"), "failed");
  assert.equal(nextParticipantStatus("opened", "consent_declined"), "declined");
  assert.equal(nextParticipantStatus("completed", "interview_failed"), "completed");
});

test("outreach cannot launch until the exact batch is approved", () => {
  assert.doesNotThrow(() =>
    assertOutreachLaunch({ studyStatus: "fieldwork_ready", outreachStatus: "approved" }),
  );
  assert.doesNotThrow(() =>
    assertOutreachLaunch({ studyStatus: "fieldwork_running", outreachStatus: "approved" }),
  );
  assert.throws(
    () => assertOutreachLaunch({ studyStatus: "fieldwork_ready", outreachStatus: "awaiting_approval" }),
    /approved/i,
  );
  assert.throws(
    () => assertOutreachLaunch({ studyStatus: "questionnaire_approved", outreachStatus: "approved" }),
    /fieldwork/i,
  );
});

test("outreach exposes an explicit draft, approval, and launch boundary", () => {
  assert.ok("createDraft" in outreachBatches);
  assert.ok("submitForApproval" in outreachBatches);
  assert.ok("approve" in outreachBatches);
  assert.ok("launch" in outreachBatches);
});

test("provider delivery cannot bypass a running approved outreach snapshot", () => {
  const running = {
    outreachStatus: "running",
    participantIncluded: true,
    questionnaireMatches: true,
    participantBatchMatches: true,
    channel: "email" as const,
    channels: ["email", "voice"] as const,
  };
  assert.doesNotThrow(() => assertOutreachDelivery(running));
  assert.throws(
    () => assertOutreachDelivery({ ...running, outreachStatus: "approved" }),
    /launched/i,
  );
  assert.throws(
    () => assertOutreachDelivery({ ...running, participantIncluded: false }),
    /participant/i,
  );
  assert.throws(
    () => assertOutreachDelivery({ ...running, channel: "voice", channels: ["email"] }),
    /channel/i,
  );
});
