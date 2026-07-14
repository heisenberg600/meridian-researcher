export type OutreachChannel = "email" | "voice";
export type ParticipantStatus =
  | "draft"
  | "invited"
  | "opened"
  | "started"
  | "completed"
  | "failed"
  | "declined"
  | "archived";

export type ParticipantLifecycleEvent =
  | "invite_sent"
  | "invite_opened"
  | "consent_granted"
  | "consent_declined"
  | "interview_started"
  | "interview_completed"
  | "interview_failed";

export function assertOutreachDraft(input: {
  studyStatus: string;
  planStatus?: string;
  questionnaireStatus: string;
  participantBatchStatus?: string;
  participantCount: number;
  channels: readonly OutreachChannel[];
}) {
  if (input.studyStatus !== "fieldwork_ready" && input.studyStatus !== "fieldwork_running") {
    throw new Error("Fieldwork must be ready before creating outreach");
  }
  if (input.questionnaireStatus !== "approved") {
    throw new Error("Approve the questionnaire before creating outreach");
  }
  if (input.planStatus && input.planStatus !== "approved") {
    throw new Error("Approve the study plan before creating outreach");
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

export function createApprovedSnapshot(input: {
  studyPlanVersionId: string;
  questionnaireVersionId: string;
  participantBatchId: string;
  requestedChannels: readonly OutreachChannel[];
  participants: ReadonlyArray<{ id: string; email?: string; phone?: string }>;
}) {
  const requested = [...new Set(input.requestedChannels)];
  return {
    studyPlanVersionId: input.studyPlanVersionId,
    questionnaireVersionId: input.questionnaireVersionId,
    participantBatchId: input.participantBatchId,
    recipients: input.participants.map((participant) => ({
      participantId: participant.id,
      channels: requested.filter(
        (channel) =>
          (channel === "email" && Boolean(participant.email)) ||
          (channel === "voice" && Boolean(participant.phone)),
      ),
    })),
  };
}

export function assertDeliveryGate(input: {
  outreachStatus: string;
  snapshotMatches: boolean;
  participantStatus: string;
  consentStatus: string;
  suppressed: boolean;
}) {
  if (input.outreachStatus !== "running") throw new Error("Outreach is not running");
  if (!input.snapshotMatches) throw new Error("The approved outreach snapshot is stale");
  if (input.suppressed) throw new Error("This contact is suppressed");
  if (input.participantStatus === "declined") throw new Error("This participant declined outreach");
  if (input.participantStatus === "archived") throw new Error("This participant is archived");
  if (input.participantStatus === "completed") throw new Error("This participant already completed the interview");
  if (input.consentStatus === "declined") throw new Error("Participant consent was declined");
}

export function deliveryIdempotencyKey(
  outreachBatchId: string,
  participantId: string,
  channel: OutreachChannel,
) {
  return `outreach/${outreachBatchId}/${participantId}/${channel}`;
}

export function planDeliveryRetry(input: {
  channel: OutreachChannel;
  status: string;
  retrySafe: boolean;
}): "dispatch" | "skip" | "manual_review" {
  if (input.status === "accepted" || input.status === "suppressed") return "skip";
  if (input.status === "dispatching" || input.status === "unknown") {
    return input.channel === "email" && input.retrySafe ? "dispatch" : "manual_review";
  }
  return input.retrySafe ? "dispatch" : "manual_review";
}

export function creditReservationForDelivery(input: {
  channel: OutreachChannel;
  estimatedMinutes: number;
}): {
  operation: "email_delivery" | "connected_voice";
  maximumCredits: number;
  measuredNativeQuantity: number;
} {
  if (!Number.isFinite(input.estimatedMinutes) || input.estimatedMinutes <= 0) {
    throw new Error("Estimated interview minutes must be positive");
  }
  if (input.channel === "email") {
    return { operation: "email_delivery", maximumCredits: 2, measuredNativeQuantity: 1 };
  }
  const seconds = Math.ceil(input.estimatedMinutes * 60);
  return {
    operation: "connected_voice",
    maximumCredits: Math.ceil(seconds / 60) * 1_200,
    measuredNativeQuantity: seconds,
  };
}

export function nextParticipantStatus(
  current: ParticipantStatus,
  event: ParticipantLifecycleEvent,
): ParticipantStatus {
  if (current === "archived" || current === "completed" || current === "declined") return current;
  if (event === "consent_declined") return "declined";
  if (event === "interview_completed") return "completed";
  if (event === "interview_failed") return "failed";
  if (event === "interview_started") return "started";
  if (event === "invite_opened" || event === "consent_granted") return "opened";
  if (event === "invite_sent") return "invited";
  return current;
}

export function assertOutreachLaunch(input: {
  studyStatus: string;
  outreachStatus: string;
}) {
  if (input.studyStatus !== "fieldwork_ready" && input.studyStatus !== "fieldwork_running") {
    throw new Error("Fieldwork is not ready to launch");
  }
  if (input.outreachStatus !== "approved") {
    throw new Error("This outreach batch must be approved before launch");
  }
}

export function assertOutreachDelivery(input: {
  outreachStatus: string;
  participantIncluded: boolean;
  questionnaireMatches: boolean;
  participantBatchMatches: boolean;
  channel: OutreachChannel;
  channels: readonly OutreachChannel[];
}) {
  if (input.outreachStatus !== "running") {
    throw new Error("Outreach must be approved and launched before provider delivery");
  }
  if (!input.participantIncluded) throw new Error("Participant is not in this outreach batch");
  if (!input.questionnaireMatches || !input.participantBatchMatches) {
    throw new Error("The approved outreach snapshot is stale");
  }
  if (!input.channels.includes(input.channel)) {
    throw new Error("This delivery channel was not approved");
  }
}
