import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("sheet grid renders a captioned semantic table in a responsive region", async () => {
  const module = await import("./SheetGrid").catch(() => null);
  assert.ok(module, "SheetGrid module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(
      module.SheetGrid,
      { caption: "Participant import review", columns: ["Participant", "Segment", "Status"] },
      createElement(
        "tr",
        null,
        createElement("td", null, "Priya Nair"),
        createElement("td", null, "Churned"),
        createElement("td", null, "Valid"),
      ),
    ),
  );

  assert.match(html, /role="region"/);
  assert.match(html, /aria-label="Participant import review"/);
  assert.match(html, /<caption[^>]*>Participant import review<\/caption>/);
  assert.match(html, /<th[^>]+scope="col"[^>]*>Participant<\/th>/);
  assert.match(html, /Priya Nair/);
});
