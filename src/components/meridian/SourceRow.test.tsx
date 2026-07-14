import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("source row exposes processing state and metadata as text", async () => {
  const module = await import("./SourceRow").catch(() => null);
  assert.ok(module, "SourceRow module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.SourceRow, {
      kind: "spreadsheet",
      meta: "48 rows · Added today",
      name: "Churn cohort.csv",
      status: "processing",
    }),
  );

  assert.match(html, /<article/);
  assert.match(html, /Churn cohort\.csv/);
  assert.match(html, /48 rows/);
  assert.match(html, />Processing</);
});
