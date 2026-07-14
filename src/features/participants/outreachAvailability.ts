type OutreachChannel = "email" | "voice";

export function getParticipantOutreachAvailability(args: {
  channel: OutreachChannel;
  hasContact: boolean;
  isInApprovedBatch: boolean;
  isManualParticipant: boolean;
  participantStatus: string;
  preferredMode: "form" | "voice" | "either";
  studyStatus: string;
}) {
  if (["archived", "completed", "declined"].includes(args.participantStatus)) {
    return { enabled: false, reason: "This participant is no longer eligible for outreach." };
  }
  if (!args.hasContact) {
    return {
      enabled: false,
      reason: args.channel === "email" ? "Add an email address first." : "Add a phone number first.",
    };
  }
  const modeMatches =
    args.preferredMode === "either" ||
    (args.channel === "email" && args.preferredMode === "form") ||
    (args.channel === "voice" && args.preferredMode === "voice");
  if (!modeMatches) {
    return { enabled: false, reason: "This channel does not match the participant’s interview mode." };
  }
  const canApproveManualParticipant =
    args.isManualParticipant &&
    ["questionnaire_approved", "participants_under_review", "fieldwork_ready", "fieldwork_running"].includes(
      args.studyStatus,
    );
  if (!args.isInApprovedBatch && !canApproveManualParticipant) {
    return { enabled: false, reason: "Approve the participant selection before outreach." };
  }
  if (
    !canApproveManualParticipant &&
    args.studyStatus !== "fieldwork_ready" &&
    args.studyStatus !== "fieldwork_running"
  ) {
    return { enabled: false, reason: "Complete participant approval before preparing outreach." };
  }
  return {
    enabled: true,
    reason: canApproveManualParticipant
      ? `Approve this participant and ${args.channel === "email" ? "send the email" : "start the call"}`
      : args.channel === "email"
        ? "Send email outreach"
        : "Start phone outreach",
  };
}
