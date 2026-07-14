import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("agent timeline communicates ordered progress without color alone", async () => {
  const module = await import("./AgentTimeline").catch(() => null);

  assert.ok(module, "AgentTimeline module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.AgentTimeline, {
      label: "Questionnaire generation",
      steps: [
        { id: "plan", label: "Read approved plan", status: "complete" },
        { id: "draft", label: "Draft neutral questions", status: "active" },
        { id: "check", label: "Check research quality", status: "pending" },
      ],
    }),
  );

  assert.match(html, /<ol[^>]+aria-label="Questionnaire generation"/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /Draft neutral questions/);
  assert.match(html, />In progress</);
  assert.match(html, />Complete</);
  assert.match(html, />Pending</);
});
