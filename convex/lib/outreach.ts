export type OutreachChannel = "email" | "voice";

export function assertOutreachDraft(input: {
  studyStatus: string;
  questionnaireStatus: string;
  participantBatchStatus?: string;
  participantCount: number;
  channels: readonly OutreachChannel[];
}) {
  if (input.studyStatus !== "fieldwork_ready") {
    throw new Error("Fieldwork must be ready before creating outreach");
  }
  if (input.questionnaireStatus !== "approved") {
    throw new Error("Approve the questionnaire before creating outreach");
  }
  if (input.participantBatchStatus && input.participantBatchStatus !== "approved") {
    throw new Error("Approve the participant batch before creating outreach");
  }
  if (input.participantCount < 1) {
    throw new Error("Select at least one participant for outreach");
  }
  if (input.channels.length < 1) {
    throw new Error("Select at least one outreach channel");
  }
}

export function assertOutreachLaunch(input: {
  studyStatus: string;
  outreachStatus: string;
}) {
  if (input.studyStatus !== "fieldwork_ready") {
    throw new Error("Fieldwork is not ready to launch");
  }
  if (input.outreachStatus !== "approved") {
    throw new Error("This outreach batch must be approved before launch");
  }
}
