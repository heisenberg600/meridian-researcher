export function assertParticipantCanAnswer(
  participantStatus: string,
  consentStatus: string,
) {
  if (!["invited", "opened", "started"].includes(participantStatus)) {
    throw new Error("This interview is no longer available");
  }
  if (consentStatus !== "granted") {
    throw new Error("Participant consent is required before saving interview answers");
  }
}
