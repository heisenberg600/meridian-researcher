import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseParticipantWorkbook } from "./workbook";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve("tests/fixtures/participant-import", name)));

describe("participant workbook parsing", () => {
  it("parses quoted CSV fields without losing commas or escaped quotes", () => {
    const result = parseParticipantWorkbook(fixture("quoted.csv"), {
      filename: "quoted.csv",
    });

    expect(result.sheetNames).toEqual(["Sheet1"]);
    expect(result.hasHeader).toBe(true);
    expect(result.headers).toEqual([
      "Full Name",
      "Email Address",
      "Phone",
      "Segment",
      "Interview Mode",
      "Notes",
    ]);
    expect(result.rows[0]).toEqual({
      "Full Name": "Nguyen, Lan",
      "Email Address": "LAN.NGUYEN@example.com",
      Phone: "+1 (415) 555-0123",
      Segment: "Enterprise",
      "Interview Mode": "either",
      Notes: 'Said "yes", available Tuesday',
    });
  });

  it.each(["multi-sheet.xlsx", "multi-sheet.xls"])(
    "lists sheets and parses the explicitly selected sheet in %s",
    (filename) => {
      const result = parseParticipantWorkbook(fixture(filename), {
        filename,
        sheetName: "Participant Roster",
      });

      expect(result.sheetNames).toEqual(["Instructions", "Participant Roster"]);
      expect(result.selectedSheet).toBe("Participant Roster");
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]["Participant Name"]).toBe("Priya Shah");
    },
  );

  it("keeps the first row as data when a CSV has no credible header row", () => {
    const result = parseParticipantWorkbook(fixture("missing-headers.csv"), {
      filename: "missing-headers.csv",
    });

    expect(result.hasHeader).toBe(false);
    expect(result.headers).toEqual(["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      "Column 1": "Asha Patel",
      "Column 2": "asha@example.com",
      "Column 3": "+442079460123",
      "Column 4": "Enterprise",
      "Column 5": "phone",
    });
    expect(result.warnings).toContain("No header row was detected; review generated column names");
  });

  it("rejects an unknown sheet instead of silently parsing a different one", () => {
    expect(() => parseParticipantWorkbook(fixture("multi-sheet.xlsx"), {
      filename: "multi-sheet.xlsx",
      sheetName: "Missing Sheet",
    })).toThrow(/Sheet Missing Sheet was not found/);
  });
});
