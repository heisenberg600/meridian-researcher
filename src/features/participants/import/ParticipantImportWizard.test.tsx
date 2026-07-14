import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ParticipantImportWizard } from "./ParticipantImportWizard";
import { createImportReviewState, importReviewReducer } from "./reviewState";

describe("ParticipantImportWizard", () => {
  afterEach(() => cleanup());

  it("starts with spreadsheet upload and keeps manual add available", () => {
    const onManualAdd = vi.fn();
    render(
      <ParticipantImportWizard
        state={createImportReviewState()}
        onFileSelected={vi.fn()}
        onMappingChange={vi.fn()}
        onCreateImport={vi.fn()}
        onUpdateRow={vi.fn()}
        onRequestApproval={vi.fn()}
        onApprove={vi.fn()}
        onManualAdd={onManualAdd}
      />,
    );

    expect(screen.getByRole("heading", { name: "Import participants" })).toBeTruthy();
    expect(screen.getByLabelText("Participant spreadsheet").getAttribute("accept")).toBe(
      ".csv,.xls,.xlsx",
    );
    expect(screen.getByText("Map columns")).toBeTruthy();
    expect(screen.getByText("Review rows")).toBeTruthy();
    expect(screen.getByText("Approve participants")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add one participant manually" }));
    expect(onManualAdd).toHaveBeenCalledOnce();
  });

  it("shows editable deterministic mapping suggestions before creating a review", () => {
    const onMappingChange = vi.fn();
    const onCreateImport = vi.fn();
    const state = mappedState();
    renderWizard({ state, onMappingChange, onCreateImport });

    expect(screen.getByRole("heading", { name: "Confirm column mapping" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name column"), { target: { value: "" } });
    expect(onMappingChange).toHaveBeenCalledWith("name", []);
    fireEvent.click(screen.getByRole("button", { name: "Create review" }));
    expect(onCreateImport).toHaveBeenCalledOnce();
  });

  it("shows row issues and blocks approval until they are edited or excluded", () => {
    const onUpdateRow = vi.fn();
    const onRequestApproval = vi.fn();
    const state = importReviewReducer(mappedState(), {
      type: "review_loaded",
      batchId: "batch-1",
      rows: [
        readyRow,
        {
          ...readyRow,
          id: "row-2",
          rowNumber: 3,
          normalized: { name: "No contact" },
          issues: ["Add a valid email address or phone number"],
          disposition: "needs_review",
        },
      ],
    });
    renderWizard({ state, onUpdateRow, onRequestApproval });

    expect(screen.getByText("Add a valid email address or phone number")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue to approval" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Exclude row 3" }));
    expect(onUpdateRow).toHaveBeenCalledWith("row-2", { name: "No contact" }, true);
  });

  it("requires a final explicit approval action", () => {
    const onApprove = vi.fn();
    const review = importReviewReducer(mappedState(), {
      type: "review_loaded",
      batchId: "batch-1",
      rows: [readyRow],
    });
    const state = importReviewReducer(review, { type: "approval_requested" });
    renderWizard({ state, onApprove });

    expect(screen.getByText("1 participant ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Approve reviewed participants" }));
    expect(onApprove).toHaveBeenCalledOnce();
  });
});

const readyRow = {
  id: "row-1",
  rowNumber: 2,
  normalized: { name: "Asha", email: "asha@example.com", preferredMode: "form" as const },
  issues: [],
  duplicate: false,
  suppressed: false,
  disposition: "ready" as const,
};

function mappedState() {
  return importReviewReducer(createImportReviewState(), {
    type: "workbook_parsed",
    workbook: {
      filename: "participants.csv",
      sheetNames: ["Sheet1"],
      selectedSheet: "Sheet1",
      headers: ["Name", "Email"],
      rows: [{ Name: "Asha", Email: "asha@example.com" }],
      hasHeader: true,
      warnings: [],
    },
    mapping: { name: ["Name"], email: ["Email"] },
  });
}

function renderWizard(overrides: Partial<React.ComponentProps<typeof ParticipantImportWizard>>) {
  return render(
    <ParticipantImportWizard
      state={createImportReviewState()}
      onFileSelected={vi.fn()}
      onMappingChange={vi.fn()}
      onCreateImport={vi.fn()}
      onUpdateRow={vi.fn()}
      onRequestApproval={vi.fn()}
      onApprove={vi.fn()}
      onManualAdd={vi.fn()}
      {...overrides}
    />,
  );
}
