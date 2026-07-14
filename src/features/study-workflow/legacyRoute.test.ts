import { describe, expect, it } from "vitest";

import { canonicalStudyTab, legacyStudyTab } from "./legacyRoute";

describe("active study route compatibility", () => {
  it.each([
    ["interview-guide", "questionnaire"],
    ["calls", "fieldwork"],
    ["feedback", "analysis"],
    ["artifacts", "report"],
    ["memory", "memory"],
  ])("maps %s to the canonical %s destination", (legacy, canonical) => {
    expect(canonicalStudyTab(legacy)).toBe(canonical);
    expect(legacyStudyTab(canonical)).toBe(legacy);
  });

  it("rejects unknown study destinations", () => {
    expect(canonicalStudyTab("observability")).toBeNull();
  });
});
