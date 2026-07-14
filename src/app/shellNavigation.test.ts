import assert from "node:assert/strict";
import test from "node:test";

test("workspace navigation exposes every customer workspace destination", async () => {
  const module = await import("./shellNavigation").catch(() => null);

  assert.ok(module, "shell navigation module should exist");
  if (!module) return;

  assert.deepEqual(
    module.workspaceNavigation.map((item) => [item.label, item.href]),
    [
      ["Studies", "/portal"],
      ["Company knowledge", "/portal/knowledge"],
      ["Company memory", "/portal/memory"],
      ["Brand", "/portal/brand"],
      ["Activity", "/portal/activity"],
      ["Billing", "/portal/billing"],
    ],
  );
});

test("study navigation builds encoded paths for the complete research workflow", async () => {
  const module = await import("./shellNavigation").catch(() => null);

  assert.ok(module, "shell navigation module should exist");
  if (!module) return;

  const navigation = module.getStudyNavigation("study / alpha");
  assert.deepEqual(
    navigation.map((item) => [item.label, item.href]),
    [
      ["Overview", "/portal/studies/study%20%2F%20alpha/overview"],
      ["Plan", "/portal/studies/study%20%2F%20alpha/plan"],
      ["Questionnaire", "/portal/studies/study%20%2F%20alpha/questionnaire"],
      ["Participants", "/portal/studies/study%20%2F%20alpha/participants"],
      ["Fieldwork", "/portal/studies/study%20%2F%20alpha/fieldwork"],
      ["Analysis", "/portal/studies/study%20%2F%20alpha/analysis"],
      ["Report", "/portal/studies/study%20%2F%20alpha/report"],
      ["Memory", "/portal/studies/study%20%2F%20alpha/memory"],
    ],
  );
});

test("shell paths compare trailing slashes without losing nested active state", async () => {
  const module = await import("./shellNavigation").catch(() => null);

  assert.ok(module, "shell navigation module should exist");
  if (!module) return;

  assert.equal(module.isShellPathActive("/portal/", "/portal"), true);
  assert.equal(module.isShellPathActive("/portal/studies/study-1/analysis", "/portal"), true);
  assert.equal(module.isShellPathActive("/portal/knowledge/source/123", "/portal/knowledge"), true);
  assert.equal(module.isShellPathActive("/portal/billing", "/portal"), false);
});
