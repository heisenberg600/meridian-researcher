import assert from "node:assert/strict";
import test from "node:test";

import { approve } from "../convex/interviewBriefs";

test("guide approval rejects a guide whose current Study Plan is not approved", async () => {
  const brief = {
    _id: "brief-1",
    studyId: "study-1",
    studyPlanVersionId: "plan-1",
    status: "awaiting_approval",
  };
  const plan = { _id: "plan-1", studyId: "study-1", status: "draft" };
  const study = {
    _id: "study-1",
    organizationId: "org-1",
    currentInterviewBriefVersionId: "brief-1",
    currentStudyPlanVersionId: "plan-1",
    status: "draft",
  };

  await assert.rejects(
    invoke(approve, approvalContext({ brief, plan, study }), { briefId: "brief-1" }),
    /Approve the current Study Plan/i,
  );
});

test("guide approval rejects a guide generated from a stale plan", async () => {
  const brief = {
    _id: "brief-1",
    studyId: "study-1",
    studyPlanVersionId: "plan-old",
    status: "awaiting_approval",
  };
  const plan = { _id: "plan-current", studyId: "study-1", status: "approved" };
  const study = {
    _id: "study-1",
    organizationId: "org-1",
    currentInterviewBriefVersionId: "brief-1",
    currentStudyPlanVersionId: "plan-current",
    status: "plan_approved",
  };

  await assert.rejects(
    invoke(approve, approvalContext({ brief, plan, study }), { briefId: "brief-1" }),
    /Approve the current Study Plan/i,
  );
});

function approvalContext(args: {
  brief: Record<string, unknown>;
  plan: Record<string, unknown>;
  study: Record<string, unknown>;
}) {
  const documents = new Map<string, Record<string, unknown>>([
    [String(args.brief._id), args.brief],
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
      patch: async () => undefined,
      insert: async () => "inserted-1",
    },
  };
}

async function invoke(endpoint: unknown, ctx: unknown, args: unknown) {
  return (endpoint as { _handler: (context: unknown, input: unknown) => Promise<void> })._handler(
    ctx,
    args,
  );
}
