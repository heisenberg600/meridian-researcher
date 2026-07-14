import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("icon button always exposes its text alternative", async () => {
  const module = await import("./IconButton").catch(() => null);

  assert.ok(module, "IconButton module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(
      module.IconButton,
      { label: "Open source details", children: createElement("svg", null, createElement("path")) },
    ),
  );

  assert.match(html, /<button[^>]+aria-label="Open source details"/);
  assert.match(html, /<svg[^>]+aria-hidden="true"/);
});
