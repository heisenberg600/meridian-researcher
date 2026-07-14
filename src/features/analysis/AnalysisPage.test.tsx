import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisPage } from "./AnalysisPage";

describe("AnalysisPage", () => {
  it("labels provisional snapshots and opens exact supporting evidence", () => {
    const onOpenEvidence = vi.fn();
    render(<AnalysisPage analysis={{ id: "run-1", snapshotKind: "provisional", status: "completed", summary: "Early signal", evidenceCount: 2 }} findings={[{ id: "finding-1", viewType: "theme", title: "Audit trail", narrative: "Operators need traceability.", strength: "supported", supportingEvidenceIds: ["evidence-1"], conflictingEvidenceIds: [] }]} evidence={{ id: "evidence-1", channel: "voice", excerpt: "We need to see who changed it.", answerLocator: "00:16–00:29", participantName: "Asha", questionLabel: "What matters most?" }} selectedEvidenceId="evidence-1" onOpenEvidence={onOpenEvidence} onCloseEvidence={vi.fn()} onStartAnalysis={vi.fn()} />);
    expect(screen.getByText("Provisional snapshot")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /supporting evidence 1/i }));
    expect(onOpenEvidence).toHaveBeenCalledWith("evidence-1");
    expect(screen.getByText(/We need to see who changed it\./)).toBeTruthy();
    expect(screen.getByText("00:16–00:29")).toBeTruthy();
  });
});
