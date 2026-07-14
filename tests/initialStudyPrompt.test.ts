import assert from "node:assert/strict";
import test from "node:test";

import { buildInitialStudyPrompt } from "../convex/lib/initialStudyPrompt";

test("the initial study prompt gives Meridian a concrete first user turn", () => {
  const prompt = buildInitialStudyPrompt({
    title: "Reduced quick-commerce ordering in urban India",
    businessDecision: "Choose whether to prioritize fees, quality, or loyalty benefits.",
  });

  assert.match(prompt, /Reduced quick-commerce ordering in urban India/);
  assert.match(prompt, /prioritize fees, quality, or loyalty benefits/);
  assert.match(prompt, /ask up to three high-value questions/);
  assert.ok(prompt.trim().length > 0);
});
