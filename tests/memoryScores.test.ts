import assert from "node:assert/strict";
import test from "node:test";

import * as memories from "../convex/organizationMemories";

test("legacy memories without scores receive a neutral fallback", () => {
  const clamp = (memories as unknown as {
    clampMemoryScore?: (value: number, fallback?: number) => number;
  }).clampMemoryScore;
  assert.ok(clamp, "clampMemoryScore must be exported");
  assert.equal(clamp(Number.NaN), 0.5);
  assert.equal(clamp(2), 1);
  assert.equal(clamp(-1), 0);
});
