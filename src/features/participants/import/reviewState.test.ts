import { describe, expect, it } from "vitest";

import {
  canAdvanceToApproval,
  createImportReviewState,
  importReviewReducer,
} from "./reviewState";

describe("participant import review state", () => {
  it("moves through Upload, Map columns, Review rows, and Approve participants", () => {
    const uploaded = importReviewReducer(createImportReviewState(), {
      type: "workbook_parsed",
      workbook: {
        filename: "participants.xlsx",
        sheetNames: ["People"],
        selectedSheet: "People",
        headers: ["Name", "Email"],
        rows: [{ Name: "Asha", Email: "asha@example.com" }],
        hasHeader: true,
        warnings: [],
      },
      mapping: { name: ["Name"], email: ["Email"] },
    });
    expect(uploaded.step).toBe("map");

    const reviewing = importReviewReducer(uploaded, {
      type: "import_created",
      batchId: "batch-1",
      rows: [readyRow],
    });
    expect(reviewing.step).toBe("review");
    expect(canAdvanceToApproval(reviewing)).toBe(true);

    const approving = importReviewReducer(reviewing, { type: "approval_requested" });
    expect(approving.step).toBe("approve");

    const completed = importReviewReducer(approving, {
      type: "import_approved",
      participantCount: 1,
    });
    expect(completed.step).toBe("complete");
  });

  it("does not advance while a row still needs review", () => {
    const state = importReviewReducer(createImportReviewState(), {
      type: "review_loaded",
      batchId: "batch-1",
      rows: [{ ...readyRow, issues: ["Email address is invalid"], disposition: "needs_review" }],
    });

    expect(canAdvanceToApproval(state)).toBe(false);
    expect(() => importReviewReducer(state, { type: "approval_requested" })).toThrow(
      /Resolve or exclude every row/,
    );
  });
});

const readyRow = {
  id: "row-1",
  rowNumber: 2,
  normalized: {
    name: "Asha",
    email: "asha@example.com",
    preferredMode: "form" as const,
  },
  issues: [],
  duplicate: false,
  suppressed: false,
  disposition: "ready" as const,
};
