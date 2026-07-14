import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const STUDY_STATUSES = [
  "draft",
  "awaiting_plan_approval",
  "plan_approved",
  "questionnaire_approved",
  "participants_under_review",
  "fieldwork_ready",
  "fieldwork_running",
  "analyzing",
  "report_ready",
  "completed",
] as const;

export type StudyStatus = (typeof STUDY_STATUSES)[number];

export type StudyCapability =
  | "generate_questionnaire"
  | "review_participants"
  | "launch_outreach"
  | "analyze_responses"
  | "generate_report";

const nextStatus: Partial<Record<StudyStatus, StudyStatus>> = {
  draft: "awaiting_plan_approval",
  awaiting_plan_approval: "plan_approved",
  plan_approved: "questionnaire_approved",
  questionnaire_approved: "participants_under_review",
  participants_under_review: "fieldwork_ready",
  fieldwork_ready: "fieldwork_running",
  fieldwork_running: "analyzing",
  analyzing: "report_ready",
  report_ready: "completed",
};

export function canTransitionStudy(from: string, to: string) {
  return nextStatus[from as StudyStatus] === to;
}

export function assertStudyCan(status: string, capability: string) {
  switch (capability as StudyCapability) {
    case "generate_questionnaire":
      if (status !== "plan_approved") {
        throw new Error("An approved Study Plan is required before generating a questionnaire");
      }
      return;
    case "review_participants":
      if (status !== "questionnaire_approved" && status !== "participants_under_review") {
        throw new Error("Approve the questionnaire before reviewing participants");
      }
      return;
    case "launch_outreach":
      if (status !== "fieldwork_ready") {
        throw new Error("Approve the reviewed participants before launching outreach");
      }
      return;
    case "analyze_responses":
      if (status !== "fieldwork_running") {
        throw new Error("Fieldwork must be running before responses can be analyzed");
      }
      return;
    case "generate_report":
      if (status !== "analyzing") {
        throw new Error("A completed analysis run is required before generating a report");
      }
      return;
    default:
      throw new Error(`Unknown study capability: ${capability}`);
  }
}

export async function transitionStudy(
  ctx: Pick<MutationCtx, "db">,
  studyId: Id<"studies">,
  to: StudyStatus,
) {
  const study = await ctx.db.get(studyId);
  if (!study) throw new Error("Study not found");
  if (!canTransitionStudy(study.status, to)) {
    throw new Error(`Invalid study transition: ${study.status} → ${to}`);
  }
  await ctx.db.patch(studyId, { status: to, updatedAt: Date.now() });
  return { ...study, status: to };
}
