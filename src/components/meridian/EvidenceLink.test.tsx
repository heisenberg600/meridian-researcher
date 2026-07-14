import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("evidence link names the source and locator", async () => {
  const module = await import("./EvidenceLink").catch(() => null);

  assert.ok(module, "EvidenceLink module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.EvidenceLink, {
      href: "/portal/studies/study-1/analysis/evidence/answer-8",
      label: "Priya Nair",
      locator: "12:48",
    }),
  );

  assert.match(html, /<a[^>]+href="[^"]*answer-8"/);
  assert.match(html, /aria-label="View evidence from Priya Nair at 12:48"/);
  assert.match(html, /Priya Nair/);
  assert.match(html, /12:48/);
});
