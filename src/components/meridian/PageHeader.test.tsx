import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("page header establishes one clear title and a labelled action region", async () => {
  const module = await import("./PageHeader").catch(() => null);
  assert.ok(module, "PageHeader module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.PageHeader, {
      action: createElement("button", { type: "button" }, "Create study"),
      description: "Frame decisions, collect evidence, and keep the chain inspectable.",
      eyebrow: "Workspace",
      title: "Studies",
    }),
  );

  assert.match(html, /<header/);
  assert.match(html, /<h1[^>]*>Studies<\/h1>/);
  assert.match(html, /aria-label="Page actions"/);
  assert.match(html, /Create study/);
});
