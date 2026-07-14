export type CanonicalStudyTab =
  | "overview"
  | "chat"
  | "plan"
  | "questionnaire"
  | "participants"
  | "fieldwork"
  | "analysis"
  | "report"
  | "memory";

export type LegacyStudyTab =
  | "overview"
  | "chat"
  | "plan"
  | "interview-guide"
  | "participants"
  | "calls"
  | "feedback"
  | "artifacts"
  | "memory";

const legacyToCanonical: Record<LegacyStudyTab, CanonicalStudyTab> = {
  overview: "overview",
  chat: "chat",
  plan: "plan",
  "interview-guide": "questionnaire",
  participants: "participants",
  calls: "fieldwork",
  feedback: "analysis",
  artifacts: "report",
  memory: "memory",
};

const canonicalToLegacy = Object.fromEntries(
  Object.entries(legacyToCanonical).map(([legacy, canonical]) => [canonical, legacy]),
) as Record<CanonicalStudyTab, LegacyStudyTab>;

export function canonicalStudyTab(value: string): CanonicalStudyTab | null {
  return legacyToCanonical[value as LegacyStudyTab] ??
    (value in canonicalToLegacy ? value as CanonicalStudyTab : null);
}

export function legacyStudyTab(value: string): LegacyStudyTab | null {
  return canonicalToLegacy[value as CanonicalStudyTab] ??
    (value in legacyToCanonical ? value as LegacyStudyTab : null);
}
