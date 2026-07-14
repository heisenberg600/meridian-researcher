import assert from "node:assert/strict";
import test from "node:test";

type RouteModule = {
  parsePortalRoute(pathname: string): unknown;
};

async function routes(): Promise<RouteModule> {
  const module = await import("../src/app/routes").catch(() => null);
  assert.ok(module, "src/app/routes must exist");
  return module as RouteModule;
}

test("workspace routes resolve only customer-visible destinations", async () => {
  const { parsePortalRoute } = await routes();

  assert.deepEqual(parsePortalRoute("/portal"), { kind: "workspace", page: "studies" });
  assert.deepEqual(parsePortalRoute("/portal/knowledge/"), { kind: "workspace", page: "knowledge" });
  assert.deepEqual(parsePortalRoute("/portal/billing?checkout=return"), { kind: "workspace", page: "billing" });
  assert.deepEqual(parsePortalRoute("/portal/management"), { kind: "not_found" });
  assert.deepEqual(parsePortalRoute("/portal/evals"), { kind: "not_found" });
});

test("study routes decode identifiers and preserve the full v1 workflow", async () => {
  const { parsePortalRoute } = await routes();

  assert.deepEqual(parsePortalRoute("/portal/studies/study%20alpha/participants"), {
    kind: "study",
    page: "participants",
    studyId: "study alpha",
  });
  assert.deepEqual(parsePortalRoute("/portal/studies/study-1/report"), {
    kind: "study",
    page: "report",
    studyId: "study-1",
  });
});

test("legacy study links resolve to their customer-facing replacements", async () => {
  const { parsePortalRoute } = await routes();

  assert.deepEqual(parsePortalRoute("/portal/studies/study-1/interview-guide"), {
    kind: "study",
    page: "questionnaire",
    studyId: "study-1",
  });
  assert.deepEqual(parsePortalRoute("/portal/studies/study-1/calls"), {
    kind: "study",
    page: "fieldwork",
    studyId: "study-1",
  });
  assert.deepEqual(parsePortalRoute("/portal/studies/study-1/artifacts"), {
    kind: "study",
    page: "report",
    studyId: "study-1",
  });
});

test("malformed encodings and unknown nested pages are not found", async () => {
  const { parsePortalRoute } = await routes();

  assert.deepEqual(parsePortalRoute("/portal/studies/%E0%A4%A/plan"), { kind: "not_found" });
  assert.deepEqual(parsePortalRoute("/portal/studies/study-1/observability"), { kind: "not_found" });
  assert.deepEqual(parsePortalRoute("/somewhere-else"), { kind: "not_found" });
});
