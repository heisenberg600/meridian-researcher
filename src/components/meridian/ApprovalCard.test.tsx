import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("pending approval keeps review context and explicit decisions together", async () => {
  const module = await import("./ApprovalCard").catch(() => null);

  assert.ok(module, "ApprovalCard module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.ApprovalCard, {
      description: "Locks questionnaire version 3 for the participant batch.",
      onApprove: () => undefined,
      onRequestChanges: () => undefined,
      status: "pending",
      title: "Approve questionnaire",
    }),
  );

  assert.match(html, /<section[^>]+aria-labelledby="approval-/);
  assert.match(html, /Approve questionnaire/);
  assert.match(html, /<button[^>]*>[\s\S]*?Approve<\/button>/);
  assert.match(html, /<button[^>]*>[\s\S]*?Request changes<\/button>/);
});

test("resolved approval is announced as a status without active controls", async () => {
  const module = await import("./ApprovalCard").catch(() => null);

  assert.ok(module, "ApprovalCard module should exist");
  if (!module) return;

  const html = renderToStaticMarkup(
    createElement(module.ApprovalCard, {
      description: "Questionnaire version 3 is locked for fieldwork.",
      resolvedBy: "Rhea Shah",
      status: "approved",
      title: "Questionnaire approved",
    }),
  );

  assert.match(html, /role="status"/);
  assert.match(html, /Approved by Rhea Shah/);
  assert.doesNotMatch(html, /<button/);
});

test("pending approval omits actions that have no callback", async () => {
  const { ApprovalCard } = await import("./ApprovalCard");
  const html = renderToStaticMarkup(
    createElement(ApprovalCard, {
      description: "The reviewer has read-only access.",
      status: "pending",
      title: "Review questionnaire",
    }),
  );

  assert.doesNotMatch(html, /<button/);
});
