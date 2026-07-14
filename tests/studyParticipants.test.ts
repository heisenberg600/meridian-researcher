import assert from "node:assert/strict";
import test from "node:test";

import { ConvexError } from "convex/values";

import { create } from "../convex/studyParticipants";

test("duplicate participant contacts are returned as client-visible application errors", async () => {
  const studyId = "study-1";
  const userId = "user-1";
  const organizationId = "organization-1";
  const duplicateParticipant = {
    _id: "participant-1",
    studyId,
    organizationId,
    email: "existing@example.com",
    status: "draft",
  };

  const ctx = {
    auth: {
      getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }),
    },
    db: {
      get: async (id: string) =>
        id === studyId ? { _id: studyId, organizationId } : null,
      insert: async () => {
        throw new Error("insert must not run for a duplicate participant");
      },
      query: (table: string) => ({
        withIndex: () => ({
          unique: async () =>
            table === "users"
              ? { _id: userId, defaultOrganizationId: organizationId }
              : null,
          collect: async () =>
            table === "studyParticipants" ? [duplicateParticipant] : [],
        }),
      }),
    },
  };

  await assert.rejects(
    () =>
      (create as unknown as { _handler: (context: unknown, args: unknown) => Promise<unknown> })._handler(ctx, {
        studyId,
        name: "Existing participant",
        email: "EXISTING@example.com",
        preferredMode: "either",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConvexError);
      assert.deepEqual(error.data, {
        code: "DUPLICATE_PARTICIPANT_CONTACT",
        message: "A participant with this email or phone already exists",
      });
      return true;
    },
  );
});
