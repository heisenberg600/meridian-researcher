import assert from "node:assert/strict";
import test from "node:test";

import * as studyPlans from "../convex/studyPlans";

type WorkflowModule = {
  canTransitionStudy: (from: string, to: string) => boolean;
  assertStudyCan: (status: string, capability: string) => void;
};

async function workflowModule(): Promise<WorkflowModule> {
  const module = await import("../convex/lib/workflow").catch(() => null);
  assert.ok(module, "convex/lib/workflow must exist");
  return module as unknown as WorkflowModule;
}

test("study plans expose a user approval mutation", () => {
  assert.ok(
    "approve" in studyPlans,
    "studyPlans.approve must exist so plan approval cannot be bypassed",
  );
});

test("the study workflow accepts only adjacent forward transitions", async () => {
  const workflow = await workflowModule();

  assert.equal(workflow.canTransitionStudy("draft", "awaiting_plan_approval"), true);
  assert.equal(workflow.canTransitionStudy("plan_approved", "questionnaire_approved"), true);
  assert.equal(workflow.canTransitionStudy("questionnaire_approved", "fieldwork_running"), false);
  assert.equal(workflow.canTransitionStudy("fieldwork_running", "draft"), false);
});

test("questionnaire generation requires an approved plan", async () => {
  const workflow = await workflowModule();

  assert.throws(
    () => workflow.assertStudyCan("awaiting_plan_approval", "generate_questionnaire"),
    /approved study plan/i,
  );
  assert.doesNotThrow(() => workflow.assertStudyCan("plan_approved", "generate_questionnaire"));
});

test("outreach requires reviewed participants and an approved questionnaire", async () => {
  const workflow = await workflowModule();

  assert.throws(
    () => workflow.assertStudyCan("questionnaire_approved", "launch_outreach"),
    /participants/i,
  );
  assert.throws(
    () => workflow.assertStudyCan("participants_under_review", "launch_outreach"),
    /participants/i,
  );
  assert.doesNotThrow(() => workflow.assertStudyCan("fieldwork_ready", "launch_outreach"));
});
