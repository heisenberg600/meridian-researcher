import type { ChangeEvent } from "react";

import { Button, Card } from "../../../components/meridian";
import {
  canAdvanceToApproval,
  type ImportMapping,
  type ImportReviewRow,
  type ImportReviewState,
} from "./reviewState";

type ParticipantImportWizardProps = {
  state: ImportReviewState;
  busy?: boolean;
  onFileSelected(file: File): void | Promise<void>;
  onMappingChange(field: keyof ImportMapping, columns: string[]): void;
  onCreateImport(): void | Promise<void>;
  onUpdateRow(
    rowId: string,
    normalized: ImportReviewRow["normalized"],
    exclude?: boolean,
  ): void | Promise<void>;
  onRequestApproval(): void;
  onApprove(): void | Promise<void>;
  onManualAdd(): void;
};

const steps = [
  { id: "upload", label: "Upload" },
  { id: "map", label: "Map columns" },
  { id: "review", label: "Review rows" },
  { id: "approve", label: "Approve participants" },
] as const;

const mappingFields: Array<{ field: keyof ImportMapping; label: string; required?: boolean }> = [
  { field: "name", label: "Name", required: true },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "segment", label: "Segment" },
  { field: "preferredMode", label: "Preferred mode" },
  { field: "notes", label: "Notes" },
];

export function ParticipantImportWizard(props: ParticipantImportWizardProps) {
  const workbook = props.state.workbook;
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void props.onFileSelected(file);
  };

  return (
    <section className="space-y-6" aria-labelledby="participant-import-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Participant ledger
          </p>
          <h2
            id="participant-import-title"
            className="font-display text-3xl tracking-[-0.025em] text-[var(--text-heading)]"
          >
            Import participants
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
            Inspect every contact before it enters fieldwork. Nothing is created until approval.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={props.onManualAdd}>
          Add one participant manually
        </Button>
      </header>

      <ol className="grid gap-px overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--border-default)] sm:grid-cols-4">
        {steps.map((step, index) => {
          const currentIndex = Math.max(0, steps.findIndex(({ id }) => id === props.state.step));
          const active = step.id === props.state.step ||
            (props.state.step === "complete" && step.id === "approve");
          const complete = index < currentIndex || props.state.step === "complete";
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-3 bg-[var(--surface-card)] px-4 py-3"
            >
              <span
                className={complete || active
                  ? "font-mono-ds text-xs font-semibold text-[var(--accent)]"
                  : "font-mono-ds text-xs text-[var(--text-muted)]"}
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-medium text-[var(--text-heading)]">{step.label}</span>
            </li>
          );
        })}
      </ol>

      {props.state.step === "upload" ? (
        <Card className="border-dashed p-8">
          <label className="block cursor-pointer rounded-md bg-[var(--bg-sunken)] px-6 py-10 text-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--border-focus)]">
            <span className="font-display block text-xl text-[var(--text-heading)]">
              Choose a participant spreadsheet
            </span>
            <span className="mt-2 block text-sm text-[var(--text-secondary)]">
              CSV, legacy XLS, or XLSX. You will choose the sheet and mappings next.
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".csv,.xls,.xlsx"
              aria-label="Participant spreadsheet"
              disabled={props.busy}
              onChange={handleFile}
            />
          </label>
        </Card>
      ) : null}

      {props.state.step === "map" && workbook ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-default)] pb-5">
            <div>
              <p className="font-mono-ds text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {workbook.selectedSheet} · {workbook.rows.length} rows
              </p>
              <h3 className="font-display mt-1 text-2xl text-[var(--text-heading)]">
                Confirm column mapping
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Suggestions are deterministic. Ambiguous columns remain unassigned for you to decide.
              </p>
            </div>
            <Button type="button" disabled={props.busy} onClick={() => void props.onCreateImport()}>
              Create review
            </Button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {mappingFields.map(({ field, label, required }) => (
              <label key={field} className="grid gap-1.5 text-sm font-medium text-[var(--text-heading)]">
                <span>{label}{required ? " *" : ""}</span>
                <select
                  aria-label={`${label} column`}
                  className="h-10 rounded-md border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm outline-none focus:border-[var(--border-focus)]"
                  value={props.state.mapping[field]?.[0] ?? ""}
                  onChange={(event) => props.onMappingChange(
                    field,
                    event.target.value ? [event.target.value] : [],
                  )}
                >
                  <option value="">Not mapped</option>
                  {workbook.headers.map((header) => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {workbook.warnings.length > 0 ? (
            <ul className="mt-5 space-y-1 text-sm text-[var(--status-warning)]">
              {workbook.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {props.state.step === "review" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4">
            <div>
              <h3 className="font-display text-2xl text-[var(--text-heading)]">Review the ledger</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Edit uncertain values or exclude the row. Suppressed contacts cannot be approved.
              </p>
            </div>
            <Button
              type="button"
              disabled={props.busy || !canAdvanceToApproval(props.state)}
              onClick={props.onRequestApproval}
            >
              Continue to approval
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[var(--bg-sunken)] text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Row</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Segment</th>
                  <th className="px-4 py-3 font-medium">Review</th>
                </tr>
              </thead>
              <tbody>
                {props.state.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border-subtle)] align-top">
                    <td className="px-4 py-3 font-mono-ds text-xs text-[var(--text-muted)]">
                      {row.rowNumber}
                    </td>
                    {(["name", "email", "phone", "segment"] as const).map((field) => (
                      <td key={field} className="px-2 py-2">
                        <input
                          aria-label={`${field}, row ${row.rowNumber}`}
                          className="h-9 w-full min-w-32 rounded-sm border border-transparent bg-transparent px-2 outline-none hover:border-[var(--border-default)] focus:border-[var(--border-focus)]"
                          defaultValue={row.normalized[field] ?? ""}
                          disabled={row.disposition === "excluded" || props.busy}
                          onBlur={(event) => void props.onUpdateRow(row.id, {
                            ...row.normalized,
                            [field]: event.target.value.trim() || undefined,
                          })}
                        />
                      </td>
                    ))}
                    <td className="w-72 px-4 py-3">
                      <p className={row.disposition === "ready"
                        ? "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--status-success)]"
                        : "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--status-warning)]"}
                      >
                        {row.disposition.replace("_", " ")}
                      </p>
                      {row.issues.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-[var(--text-secondary)]">
                          {row.issues.map((issue) => <li key={issue}>{issue}</li>)}
                        </ul>
                      ) : null}
                      {row.disposition !== "excluded" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          aria-label={`Exclude row ${row.rowNumber}`}
                          onClick={() => void props.onUpdateRow(row.id, row.normalized, true)}
                        >
                          Exclude
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {props.state.step === "approve" ? (
        <Card className="grid gap-6 p-7 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-mono-ds text-xs uppercase tracking-[0.12em] text-[var(--accent)]">
              Final approval
            </p>
            <h3 className="font-display mt-2 text-3xl text-[var(--text-heading)]">
              {props.state.rows.filter((row) => row.disposition === "ready").length} participant ready
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Approval creates draft participant records and unlocks fieldwork. It does not contact anyone.
            </p>
          </div>
          <Button type="button" disabled={props.busy} onClick={() => void props.onApprove()}>
            Approve reviewed participants
          </Button>
        </Card>
      ) : null}

      {props.state.step === "complete" ? (
        <Card className="p-7">
          <p className="font-display text-2xl text-[var(--text-heading)]">Participant review approved</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {props.state.participantCount ?? 0} participant records are ready for fieldwork planning.
          </p>
        </Card>
      ) : null}

      {props.state.error ? (
        <p role="alert" className="text-sm text-[var(--status-danger)]">{props.state.error}</p>
      ) : null}
    </section>
  );
}
