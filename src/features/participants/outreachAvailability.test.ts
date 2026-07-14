import { describe, expect, it } from "vitest";

import { getParticipantOutreachAvailability } from "./outreachAvailability";

const ready = {
  channel: "email" as const,
  hasContact: true,
  isInApprovedBatch: true,
  isManualParticipant: false,
  participantStatus: "draft",
  preferredMode: "either" as const,
  studyStatus: "fieldwork_ready",
};

describe("participant outreach availability", () => {
  it("enables approved participants when fieldwork is ready or running", () => {
    expect(getParticipantOutreachAvailability(ready).enabled).toBe(true);
    expect(getParticipantOutreachAvailability({ ...ready, studyStatus: "fieldwork_running" }).enabled).toBe(true);
  });

  it("requires participant approval and a matching contact channel", () => {
    expect(getParticipantOutreachAvailability({ ...ready, isInApprovedBatch: false }).enabled).toBe(false);
    expect(getParticipantOutreachAvailability({ ...ready, hasContact: false }).reason).toMatch(/email/i);
    expect(getParticipantOutreachAvailability({ ...ready, channel: "voice", preferredMode: "form" }).enabled).toBe(false);
  });

  it("lets a manual participant start outreach before a separate batch approval", () => {
    expect(getParticipantOutreachAvailability({
      ...ready,
      isInApprovedBatch: false,
      isManualParticipant: true,
      studyStatus: "questionnaire_approved",
    })).toEqual({
      enabled: true,
      reason: "Approve this participant and send the email",
    });
  });

});
