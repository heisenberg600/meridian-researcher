import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("the bare Meridian import preserves legacy and shell component APIs", async () => {
  const module = (await import("@/components/meridian")) as Record<string, unknown>;

  assert.equal(typeof module.cx, "function");
  assert.ok(module.TextInput);
  assert.ok(module.Textarea);
  assert.ok(module.SectionHeader);
  assert.ok(module.AgentTimeline);
  assert.ok(module.ErrorState);
  assert.ok(module.Toast);

  const html = renderToStaticMarkup(
    createElement(module.SectionHeader as React.ComponentType<{
      action: React.ReactNode;
      description: string;
      eyebrow: string;
      title: string;
    }>, {
      action: createElement("button", { type: "button" }, "Create study"),
      description: "Keep evidence and decisions connected.",
      eyebrow: "Workspace",
      title: "Studies",
    }),
  );

  assert.match(html, /<h1[^>]*>Studies<\/h1>/);
  assert.match(html, /Workspace/);
  assert.match(html, /Create study/);

  const badgeHtml = renderToStaticMarkup(
    createElement(module.Badge as React.ComponentType<{ children: React.ReactNode; tone: string }>, {
      children: "Needs review",
      tone: "warning",
    }),
  );
  assert.match(badgeHtml, /status-warning/);
});
