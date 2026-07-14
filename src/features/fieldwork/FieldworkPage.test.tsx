import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FieldworkPage } from "./FieldworkPage";

describe("FieldworkPage", () => {
  afterEach(() => cleanup());
  it("shows the lifecycle summary, participant operations, and response master/detail", () => {
    render(
      <FieldworkPage
        batch={{ id: "batch-1", status: "running", participantCount: 2, channels: ["email", "voice"], questionnaireVersion: 4 }}
        participants={[
          { id: "p1", name: "Asha Rao", segment: "Operators", status: "completed", consentStatus: "granted", channels: ["email"], deliveryStatus: "accepted" },
          { id: "p2", name: "Mira Shah", segment: "Leaders", status: "failed", consentStatus: "pending", channels: ["voice"], deliveryStatus: "failed", retryDeliveryId: "delivery-2" },
        ]}
        responses={[
          { id: "response-1", participantId: "p1", participantName: "Asha Rao", channel: "voice", status: "completed", occurredAt: 1_721_000_000_000, summary: "Asha needs faster recruiting.", transcript: [{ role: "participant", message: "Recruiting is the bottleneck." }] },
        ]}
        onApprove={vi.fn(async () => undefined)}
        onLaunch={vi.fn(async () => undefined)}
        onRetry={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("heading", { name: "Fieldwork operations" })).toBeTruthy();
    expect(screen.getAllByText("Asha Rao")).toHaveLength(2);
    expect(screen.getByText("Asha needs faster recruiting.")).toBeTruthy();
    expect(screen.getByText("Recruiting is the bottleneck.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry Mira Shah" })).toBeTruthy();
  });

  it("routes a failed delivery retry through the supplied control-plane action", () => {
    const onRetry = vi.fn(async () => undefined);
    render(
      <FieldworkPage
        batch={null}
        participants={[{ id: "p2", name: "Mira Shah", status: "failed", consentStatus: "pending", channels: ["voice"], deliveryStatus: "failed", retryDeliveryId: "delivery-2" }]}
        responses={[]}
        onApprove={vi.fn(async () => undefined)}
        onLaunch={vi.fn(async () => undefined)}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry Mira Shah" }));
    expect(onRetry).toHaveBeenCalledWith("delivery-2");
  });
});
