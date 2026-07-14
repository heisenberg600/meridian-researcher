import assert from "node:assert/strict";
import test from "node:test";

import * as interviews from "../convex/interviews";
import { assertParticipantCanAnswer } from "../convex/lib/interviewAccess";

test("participant answers require a live invitation and explicit consent", () => {
  assert.doesNotThrow(() => assertParticipantCanAnswer("started", "granted"));
  assert.throws(() => assertParticipantCanAnswer("invited", "pending"), /consent/i);
  assert.throws(() => assertParticipantCanAnswer("declined", "granted"), /available/i);
  assert.throws(() => assertParticipantCanAnswer("archived", "granted"), /available/i);
});

test("the interview API exposes an explicit consent mutation", () => {
  assert.ok("recordConsent" in interviews);
});
