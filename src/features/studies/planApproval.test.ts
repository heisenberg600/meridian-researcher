import { describe, expect, it } from "vitest";
import {
  getInterviewGuideApprovalUi,
  getParticipantReviewUi,
  getPlanApprovalUi,
  getQuestionnaireGenerationUi,
} from "./planApproval";

describe("study plan approval UI", () => {
  it.each(["draft", "awaiting_approval"])("offers approval for a current %s plan", (status) => {
    expect(getPlanApprovalUi(status)).toEqual({ canApprove: true, label: "Approve Study Plan" });
  });

  it("sends an unapproved questionnaire user to approve the plan", () => {
    expect(getQuestionnaireGenerationUi("draft")).toEqual({
      canGenerate: false,
      message: "Approve the current Study Plan before generating the interview guide.",
      actionLabel: "Generate from Study Plan",
      reviewLabel: "Review & Approve Study Plan",
    });
  });

  it("enables questionnaire generation only for an approved plan", () => {
    expect(getQuestionnaireGenerationUi("approved")).toEqual({
      canGenerate: true,
      message: null,
      actionLabel: "Generate from Study Plan",
      reviewLabel: null,
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
    expect(getParticipantReviewUi("fieldwork_running")).toEqual({
      canReview: false,
      message: null,
      actionLabel: "Open Interview Guide",
    });
  });

  it("blocks guide approval until it is based on the current approved plan", () => {
    expect(getInterviewGuideApprovalUi({
      currentPlanId: "plan-1",
      guidePlanId: "plan-1",
      guideStatus: "awaiting_approval",
      isCurrentGuide: true,
      planStatus: "draft",
    })).toEqual({
      canApprove: false,
      message: "Approve the current Study Plan before approving this interview guide.",
    });

    expect(getInterviewGuideApprovalUi({
      currentPlanId: "plan-2",
      guidePlanId: "plan-1",
      guideStatus: "awaiting_approval",
      isCurrentGuide: true,
      planStatus: "approved",
    }).canApprove).toBe(false);

    expect(getInterviewGuideApprovalUi({
      currentPlanId: "plan-1",
      guidePlanId: "plan-1",
      guideStatus: "awaiting_approval",
      isCurrentGuide: true,
      planStatus: "approved",
    })).toEqual({ canApprove: true, message: null });
  });
});
