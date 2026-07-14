import type { ParsedParticipantWorkbook } from "./workbook";

export type ImportStep = "upload" | "map" | "review" | "approve" | "complete";

export type ImportMapping = Partial<Record<
  "name" | "email" | "phone" | "segment" | "preferredMode" | "notes",
  string[]
>>;

export type ImportReviewRow = {
  id: string;
  rowNumber: number;
  normalized: {
    name?: string;
    email?: string;
    phone?: string;
    segment?: string;
    preferredMode?: "form" | "voice" | "either";
  };
  issues: string[];
  duplicate: boolean;
  suppressed: boolean;
  disposition: "ready" | "needs_review" | "excluded";
};

export type ImportReviewState = {
  step: ImportStep;
  workbook?: ParsedParticipantWorkbook & { filename: string };
  mapping: ImportMapping;
  batchId?: string;
  rows: ImportReviewRow[];
  participantCount?: number;
  error?: string;
};

export type ImportReviewEvent =
  | {
      type: "workbook_parsed";
      workbook: ParsedParticipantWorkbook & { filename: string };
      mapping: ImportMapping;
    }
  | { type: "import_created" | "review_loaded"; batchId: string; rows: ImportReviewRow[] }
  | { type: "row_updated"; row: ImportReviewRow }
  | { type: "approval_requested" }
  | { type: "import_approved"; participantCount: number }
  | { type: "failed"; message: string }
  | { type: "reset" };

export function createImportReviewState(): ImportReviewState {
  return { step: "upload", mapping: {}, rows: [] };
}

export function canAdvanceToApproval(state: ImportReviewState) {
  return state.step === "review" &&
    state.rows.some((row) => row.disposition === "ready") &&
    state.rows.every((row) => row.disposition !== "needs_review");
}

export function importReviewReducer(
  state: ImportReviewState,
  event: ImportReviewEvent,
): ImportReviewState {
  switch (event.type) {
    case "workbook_parsed":
      return {
        step: "map",
        workbook: event.workbook,
        mapping: event.mapping,
        rows: [],
      };
    case "import_created":
    case "review_loaded":
      return { ...state, step: "review", batchId: event.batchId, rows: event.rows, error: undefined };
    case "row_updated":
      return {
        ...state,
        rows: state.rows.map((row) => row.id === event.row.id ? event.row : row),
        error: undefined,
      };
    case "approval_requested":
      if (!canAdvanceToApproval(state)) {
        throw new Error("Resolve or exclude every row that needs review before approval");
      }
      return { ...state, step: "approve", error: undefined };
    case "import_approved":
      if (state.step !== "approve") throw new Error("Import approval was not requested");
      return { ...state, step: "complete", participantCount: event.participantCount };
    case "failed":
      return { ...state, error: event.message };
    case "reset":
      return createImportReviewState();
  }
}
