import { describe, expect, it } from "vitest";
import { getParticipantReviewUi, getPlanApprovalUi, getQuestionnaireGenerationUi } from "./planApproval";

describe("study plan approval UI", () => {
  it.each(["draft", "awaiting_approval"])("offers approval for a current %s plan", (status) => {
    expect(getPlanApprovalUi(status)).toEqual({ canApprove: true, label: "Approve Study Plan" });
  });

  it("sends an unapproved questionnaire user to approve the plan", () => {
    expect(getQuestionnaireGenerationUi("draft")).toEqual({
      canGenerate: false,
      message: "Approve the current Study Plan before generating the interview guide.",
      actionLabel: "Review & Approve Study Plan",
    });
  });

  it("enables questionnaire generation only for an approved plan", () => {
    expect(getQuestionnaireGenerationUi("approved")).toEqual({
      canGenerate: true,
      message: null,
      actionLabel: "Generate from Study Plan",
    });
  });

  it("blocks participant review until the questionnaire is approved", () => {
    expect(getParticipantReviewUi("draft")).toEqual({
      canReview: false,
      message: "Approve the interview guide before importing or reviewing participants.",
      actionLabel: "Open Interview Guide",
    });
    expect(getParticipantReviewUi("questionnaire_approved").canReview).toBe(true);
    expect(getParticipantReviewUi("participants_under_review").canReview).toBe(true);
  });
});
