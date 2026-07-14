import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("empty state has a named region and keeps its action visible", async () => {
  const module = await import("./EmptyState").catch(() => null);

  assert.ok(module, "EmptyState module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.EmptyState, {
      action: createElement("a", { href: "/portal/knowledge/new" }, "Add a source"),
      description: "Give Meridian company context before the first study.",
      title: "No sources yet",
    }),
  );

  assert.match(html, /<section[^>]+aria-labelledby="empty-state-/);
  assert.match(html, /<h2[^>]+id="empty-state-/);
  assert.match(html, /No sources yet/);
  assert.match(html, /href="\/portal\/knowledge\/new"/);
});
