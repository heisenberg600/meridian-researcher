// @vitest-environment node
import assert from "node:assert/strict";
import { test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PromptInput, PromptInputTextarea } from "./prompt-input";

test("the prompt composer owns one focus treatment", () => {
  const html = renderToStaticMarkup(
    createElement(PromptInput, null, createElement(PromptInputTextarea)),
  );

  assert.match(html, /focus-within:border-\[var\(--border-focus\)\]/);
  assert.match(html, /outline:none/);
});
