import * as XLSX from "xlsx";
import * as fs from "node:fs";
import { fileURLToPath, URL } from "node:url";

XLSX.set_fs(fs);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([
    ["Read me"],
    ["Choose the Participant Roster sheet"],
  ]),
  "Instructions",
);
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([
    ["Participant Name", "Work Email", "Mobile Number", "Cohort", "Contact Method"],
    ["Priya Shah", "PRIYA@example.com", "+91 98765 43210", "Enterprise", "both"],
    ["Jon Bell", "jon@example.com", "", "SMB", "form"],
  ]),
  "Participant Roster",
);

XLSX.writeFile(workbook, fileURLToPath(new URL("./multi-sheet.xlsx", import.meta.url)), {
  bookType: "xlsx",
});
XLSX.writeFile(workbook, fileURLToPath(new URL("./multi-sheet.xls", import.meta.url)), {
  bookType: "biff8",
});
