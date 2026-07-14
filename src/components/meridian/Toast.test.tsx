import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

test("toast is announced and restores pointer events for its action", async () => {
  const module = await import("./Toast").catch(() => null);
  assert.ok(module, "Toast module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.Toast, {
      action: createElement("button", { type: "button" }, "Undo"),
      children: "Memory saved",
      tone: "success",
    }),
  );

  assert.match(html, /role="status"/);
  assert.match(html, /pointer-events-auto/);
  assert.match(html, /Memory saved/);
  assert.match(html, /<button[^>]*>Undo<\/button>/);
});
