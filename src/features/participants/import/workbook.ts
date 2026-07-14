import * as XLSX from "xlsx";

export type ParsedParticipantWorkbook = {
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  hasHeader: boolean;
  warnings: string[];
};

const knownHeaderTerms = new Set([
  "name",
  "full name",
  "participant",
  "participant name",
  "first name",
  "last name",
  "email",
  "email address",
  "work email",
  "phone",
  "phone number",
  "mobile",
  "mobile number",
  "segment",
  "cohort",
  "preferred mode",
  "interview mode",
  "contact method",
  "notes",
]);

export function parseParticipantWorkbook(
  data: ArrayBuffer | Uint8Array,
  options: { filename: string; sheetName?: string },
): ParsedParticipantWorkbook {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", raw: false });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "unknown workbook error";
    throw new Error(`Could not parse ${options.filename}: ${message}`);
  }

  const sheetNames = [...workbook.SheetNames];
  const selectedSheet = options.sheetName ?? sheetNames[0];
  if (!selectedSheet || !workbook.Sheets[selectedSheet]) {
    throw new Error(`Sheet ${selectedSheet ?? "(none)"} was not found in ${options.filename}`);
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[selectedSheet], {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }).map((row) => row.map(toCellText));
  const firstPopulatedIndex = matrix.findIndex((row) => row.some(Boolean));
  if (firstPopulatedIndex < 0) {
    return {
      sheetNames,
      selectedSheet,
      headers: [],
      rows: [],
      hasHeader: false,
      warnings: ["The selected sheet is empty"],
    };
  }

  const populated = matrix.slice(firstPopulatedIndex);
  const hasHeader = isCredibleHeader(populated[0]);
  const columnCount = populated.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const warnings: string[] = [];
  const headers = hasHeader
    ? makeUniqueHeaders(populated[0], columnCount, warnings)
    : Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  if (!hasHeader) {
    warnings.push("No header row was detected; review generated column names");
  }

  const dataRows = populated.slice(hasHeader ? 1 : 0);
  const rows = dataRows
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
  return { sheetNames, selectedSheet, headers, rows, hasHeader, warnings };
}

function toCellText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isCredibleHeader(row: string[]) {
  const populated = row.filter(Boolean);
  if (populated.length === 0) return false;
  const knownTerms = populated.filter((value) => knownHeaderTerms.has(normalizeHeader(value))).length;
  return knownTerms >= Math.min(2, populated.length);
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function makeUniqueHeaders(row: string[], count: number, warnings: string[]) {
  const used = new Map<string, number>();
  return Array.from({ length: count }, (_, index) => {
    const base = row[index]?.trim() || `Column ${index + 1}`;
    if (!row[index]?.trim()) warnings.push(`Column ${index + 1} has no header`);
    const occurrence = (used.get(base.toLowerCase()) ?? 0) + 1;
    used.set(base.toLowerCase(), occurrence);
    if (occurrence === 1) return base;
    warnings.push(`Duplicate header ${base} was renamed`);
    return `${base} (${occurrence})`;
  });
}
