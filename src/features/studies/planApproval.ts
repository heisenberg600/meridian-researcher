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
    actionLabel: canGenerate ? "Generate from Study Plan" : "Review & Approve Study Plan",
  };
}
