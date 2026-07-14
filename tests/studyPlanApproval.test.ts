import assert from "node:assert/strict";
import test from "node:test";

import { approve } from "../convex/studyPlans";

test("a user can explicitly approve the current draft plan", async (context) => {
  context.mock.method(Date, "now", () => 4_200);
  const plan = {
    _id: "plan-1",
    organizationId: "org-1",
    studyId: "study-1",
    version: 1,
    markdown: "# Study plan",
    status: "draft",
    createdAt: 1_000,
  };
  const study = {
    _id: "study-1",
    organizationId: "org-1",
    currentStudyPlanVersionId: "plan-1",
    status: "draft",
  };
  const patches: Array<{ id: string; value: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];

  const result = await invoke(approve, approvalContext({ plan, study, patches, inserts }), {
    planVersionId: "plan-1",
  });

  assert.equal(result, "plan-1");
  assert.ok(patches.some(({ id, value }) => id === "plan-1" && value.status === "approved"));
  assert.ok(patches.some(({ id, value }) => id === "study-1" && value.status === "plan_approved"));
  assert.ok(inserts.some(({ table }) => table === "approvals"));
});

function approvalContext(args: {
  plan: Record<string, unknown>;
  study: Record<string, unknown>;
  patches: Array<{ id: string; value: Record<string, unknown> }>;
  inserts: Array<{ table: string; value: Record<string, unknown> }>;
}) {
  const documents = new Map<string, Record<string, unknown>>([
    [String(args.plan._id), args.plan],
    [String(args.study._id), args.study],
  ]);
  return {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }) },
    db: {
      get: async (id: string) => documents.get(id) ?? null,
      query: (table: string) => ({
        withIndex: () => ({
          unique: async () => {
            if (table === "users") return { _id: "user-1", defaultOrganizationId: "org-1" };
            if (table === "memberships") return { _id: "membership-1" };
            return null;
          },
        }),
      }),
      patch: async (id: string, value: Record<string, unknown>) => {
        args.patches.push({ id, value });
        documents.set(id, { ...documents.get(id), ...value });
      },
      insert: async (table: string, value: Record<string, unknown>) => {
        args.inserts.push({ table, value });
        return `${table}-${args.inserts.length}`;
      },
    },
  };
}

async function invoke(endpoint: unknown, ctx: unknown, args: unknown) {
  return (endpoint as { _handler: (context: unknown, input: unknown) => Promise<string> })._handler(ctx, args);
}
