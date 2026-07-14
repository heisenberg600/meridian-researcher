import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("study shell describes lifecycle context and the active research destination", async () => {
  const module = await import("./StudyShell").catch(() => null);

  assert.ok(module, "StudyShell module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(
      module.StudyShell,
      {
        children: createElement("p", null, "Analysis content"),
        currentPath: "/portal/studies/study-1/analysis",
        nextAction: {
          description: "Review the evidence behind 4 provisional findings.",
          href: "/portal/studies/study-1/analysis",
          label: "Review findings",
        },
        study: {
          id: "study-1",
          title: "Onboarding friction",
          status: "analyzing",
        },
      },
    ),
  );

  assert.match(html, /<nav[^>]+aria-label="Study"/);
  assert.match(html, /aria-current="page"[^>]*href="[^"]*\/analysis"[^>]*>[\s\S]*?Analysis<\/a>/);
  assert.match(html, /Onboarding friction/);
  assert.match(html, /Analyzing/);
  assert.match(html, /Review findings/);
  assert.match(html, /aria-label="Study destinations"/);
  assert.doesNotMatch(html, /08<\/span>\s*Memory/);
});
