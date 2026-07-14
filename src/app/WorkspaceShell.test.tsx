import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("workspace shell renders semantic responsive navigation and a skip target", async () => {
  const module = await import("./WorkspaceShell").catch(() => null);

  assert.ok(module, "WorkspaceShell module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(
      module.WorkspaceShell,
      {
        children: createElement("p", null, "Knowledge content"),
        currentPath: "/portal/knowledge",
        user: { name: "Rhea Shah", email: "rhea@example.com" },
        workspaceName: "Atlas Labs",
      },
    ),
  );

  assert.match(html, /href="#main-content"/);
  assert.match(html, /<nav[^>]+aria-label="Workspace"/);
  assert.match(html, /aria-current="page"[^>]*>[^<]*<span[^>]*>Company knowledge<\/span>/);
  assert.match(html, /<main[^>]+id="main-content"[^>]+tabindex="-1"/);
  assert.match(html, /Atlas Labs/);
  assert.match(html, /Rhea Shah/);
  assert.doesNotMatch(html, />Management</);
  assert.doesNotMatch(html, />Evals</);
  assert.doesNotMatch(html, />Observability</);
});
