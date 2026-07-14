import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

test("error state announces the failure and exposes retry only when actionable", async () => {
  const module = await import("./ErrorState").catch(() => null);
  assert.ok(module, "ErrorState module should exist");
  if (!module) return;

  const actionable = renderToStaticMarkup(
    createElement(module.ErrorState, {
      description: "Check the connection and try again.",
      onRetry: () => undefined,
      title: "Knowledge could not load",
    }),
  );
  assert.match(actionable, /role="alert"/);
  assert.match(actionable, /Knowledge could not load/);
  assert.match(actionable, /<button[^>]*>[\s\S]*?Try again<\/button>/);

  const passive = renderToStaticMarkup(
    createElement(module.ErrorState, {
      description: "Return to Studies.",
      title: "Study not found",
    }),
  );
  assert.doesNotMatch(passive, /<button/);
});
