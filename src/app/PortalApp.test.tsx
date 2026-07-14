import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("portal app composes workspace and study shells without owning route parsing", async () => {
  const module = await import("./PortalApp").catch(() => null);
  assert.ok(module, "PortalApp module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(
      module.PortalApp,
      {
        children: createElement("p", null, "Plan review"),
        currentPath: "/portal/studies/study-1/plan",
        study: { id: "study-1", status: "awaiting_plan_approval", title: "Retention decision" },
        user: { name: "Rhea Shah" },
        workspaceName: "Atlas Labs",
      },
    ),
  );

  assert.match(html, /<nav[^>]+aria-label="Workspace"/);
  assert.match(html, /<nav[^>]+aria-label="Study"/);
  assert.match(html, /Retention decision/);
  assert.match(html, /Plan review/);
});
