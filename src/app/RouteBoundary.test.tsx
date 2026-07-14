import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("route boundary renders accessible loading and retryable error states", async () => {
  const module = await import("./RouteBoundary").catch(() => null);

  assert.ok(module, "RouteBoundary module should exist");
  if (!module) return;

  const loadingHtml = renderToStaticMarkup(
    createElement(module.RouteBoundary, {
      state: { status: "loading", label: "Loading company knowledge" },
    }),
  );
  assert.match(loadingHtml, /role="status"/);
  assert.match(loadingHtml, /aria-live="polite"/);
  assert.match(loadingHtml, /Loading company knowledge/);

  const errorHtml = renderToStaticMarkup(
    createElement(module.RouteBoundary, {
      state: {
        status: "error",
        title: "Knowledge could not load",
        description: "Check your connection and try again.",
        onRetry: () => undefined,
      },
    }),
  );
  assert.match(errorHtml, /role="alert"/);
  assert.match(errorHtml, /Knowledge could not load/);
  assert.match(errorHtml, /<button[^>]*>[\s\S]*?Try again<\/button>/);
});
