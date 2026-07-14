import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("memory editor uses a labelled form with explicit save and cancel actions", async () => {
  const module = await import("./MemoryEditor").catch(() => null);
  assert.ok(module, "MemoryEditor module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.MemoryEditor, {
      label: "Company context",
      name: "memory-value",
      onCancel: () => undefined,
      onChange: () => undefined,
      onSave: () => undefined,
      value: "Customers renew annually after procurement review.",
    }),
  );

  assert.match(html, /<form/);
  assert.match(html, /<label[^>]+for="memory-/);
  assert.match(html, /<textarea[^>]+name="memory-value"/);
  assert.match(html, /<button[^>]+type="submit"[^>]*>Save memory<\/button>/);
  assert.match(html, /<button[^>]+type="button"[^>]*>Cancel<\/button>/);
});
