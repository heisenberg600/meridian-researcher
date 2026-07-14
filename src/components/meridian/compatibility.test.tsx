import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("the Meridian index preserves the established component API", async () => {
  const module = await import("./index");

  assert.equal(typeof module.cx, "function");
  assert.ok(module.TextInput);
  assert.ok(module.Textarea);
  assert.ok(module.SectionHeader);

  const html = renderToStaticMarkup(
    createElement(module.SectionHeader, {
      action: createElement("button", { type: "button" }, "Create study"),
      description: "Keep evidence and decisions connected.",
      eyebrow: "Workspace",
      title: "Studies",
    }),
  );

  assert.match(html, /<h1[^>]*>Studies<\/h1>/);
  assert.match(html, /Workspace/);
  assert.match(html, /Create study/);
});
