type PlanStatus = "draft" | "awaiting_approval" | "approved" | "superseded" | string;

export function getPlanApprovalUi(status: PlanStatus) {
  return {
    canApprove: status === "draft" || status === "awaiting_approval",
    label: "Approve Study Plan",
  };
}

export function getQuestionnaireGenerationUi(status?: PlanStatus) {
  const canGenerate = status === "approved";
  return {
    canGenerate,
    message: canGenerate
      ? null
      : "Approve the current Study Plan before generating the interview guide.",
    actionLabel: "Generate from Study Plan",
    reviewLabel: canGenerate ? null : "Review & Approve Study Plan",
  };
}

export function getParticipantReviewUi(studyStatus: string) {
  const canReview = studyStatus === "questionnaire_approved" || studyStatus === "participants_under_review";
  const needsGuideApproval = ["draft", "awaiting_plan_approval", "plan_approved"].includes(studyStatus);
  return {
    canReview,
    message: needsGuideApproval
      ? "Approve the interview guide before importing or reviewing participants."
      : null,
    actionLabel: "Open Interview Guide",
  };
}

export function getInterviewGuideApprovalUi(args: {
  currentPlanId?: string;
  guidePlanId?: string;
  guideStatus: string;
  isCurrentGuide: boolean;
  planStatus?: PlanStatus;
}) {
  const isBasedOnCurrentPlan = Boolean(
    args.currentPlanId && args.guidePlanId === args.currentPlanId,
  );
  const canApprove =
    args.isCurrentGuide &&
    args.guideStatus === "awaiting_approval" &&
    args.planStatus === "approved" &&
    isBasedOnCurrentPlan;

  let message: string | null = null;
  if (args.isCurrentGuide && args.guideStatus === "awaiting_approval" && !canApprove) {
    message = args.planStatus !== "approved"
      ? "Approve the current Study Plan before approving this interview guide."
      : "This guide was not generated from the current approved Study Plan. Generate a new version before approval.";
  }

  return { canApprove, message };
}
