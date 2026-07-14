import { describe, expect, it, vi } from "vitest";
import { runParticipantQuickOutreach } from "./quickOutreach";

describe("participant quick outreach", () => {
  it("prepares an approved email batch before invoking Resend", async () => {
    const events: string[] = [];
    const result = await runParticipantQuickOutreach({
      participantId: "participant-1",
      channel: "email",
      prepare: vi.fn(async () => {
        events.push("prepare");
        return { outreachBatchId: "batch-1", reused: false };
      }),
      sendEmail: vi.fn(async () => {
        events.push("email");
        return { emailId: "email-1", inviteUrl: "https://example.com/interview/token" };
      }),
      sendCall: vi.fn(),
    });

    expect(events).toEqual(["prepare", "email"]);
    expect(result.message).toBe("Invitation email sent.");
  });

  it("surfaces a failed ElevenLabs call", async () => {
    await expect(runParticipantQuickOutreach({
      participantId: "participant-1",
      channel: "call",
      prepare: async () => ({ outreachBatchId: "batch-1", reused: false }),
      sendEmail: vi.fn(),
      sendCall: async () => ({ status: "failed", error: "ElevenLabs rejected the number" }),
    })).rejects.toThrow("ElevenLabs rejected the number");
  });
});
