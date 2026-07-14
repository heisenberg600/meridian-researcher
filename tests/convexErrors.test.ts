import assert from "node:assert/strict";
import test from "node:test";

import { ConvexError } from "convex/values";

import * as utils from "../src/lib/utils";

type ErrorFormatter = (cause: unknown, fallback: string) => string;

function formatter(): ErrorFormatter {
  const candidate = (utils as unknown as { getUserFacingConvexError?: ErrorFormatter })
    .getUserFacingConvexError;
  if (!candidate) assert.fail("getUserFacingConvexError must be exported");
  return candidate;
}

test("client-visible ConvexError messages are shown to the user", () => {
  const error = new ConvexError({
    code: "DUPLICATE_PARTICIPANT_CONTACT",
    message: "A participant with this email or phone already exists",
  });

  assert.equal(
    formatter()(error, "Could not save participant"),
    "A participant with this email or phone already exists",
  );
});

test("unexpected server errors use a safe fallback", () => {
  assert.equal(
    formatter()(new Error("database implementation detail"), "Could not save participant"),
    "Could not save participant",
  );
});
