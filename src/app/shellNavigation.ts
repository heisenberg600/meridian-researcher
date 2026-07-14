export type ShellNavigationItem = {
  id: string;
  label: string;
  href: string;
  shortLabel?: string;
};

export const workspaceNavigation: readonly ShellNavigationItem[] = [
  { id: "studies", label: "Studies", href: "/portal" },
  { id: "knowledge", label: "Company knowledge", shortLabel: "Knowledge", href: "/portal/knowledge" },
  { id: "memory", label: "Company memory", shortLabel: "Memory", href: "/portal/memory" },
  { id: "brand", label: "Brand", href: "/portal/brand" },
  { id: "activity", label: "Activity", href: "/portal/activity" },
  { id: "billing", label: "Billing", href: "/portal/billing" },
] as const;

const studyDestinations = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Plan" },
  { id: "questionnaire", label: "Questionnaire" },
  { id: "participants", label: "Participants" },
  { id: "fieldwork", label: "Fieldwork" },
  { id: "analysis", label: "Analysis" },
  { id: "report", label: "Report" },
  { id: "memory", label: "Memory" },
] as const;

export function getStudyNavigation(studyId: string): readonly ShellNavigationItem[] {
  const encodedStudyId = encodeURIComponent(studyId);
  return studyDestinations.map((destination) => ({
    ...destination,
    href: `/portal/studies/${encodedStudyId}/${destination.id}`,
  }));
}

export function isShellPathActive(currentPath: string, href: string): boolean {
  const current = normalizePath(currentPath);
  const destination = normalizePath(href);

  if (destination === "/portal") {
    return current === destination || current.startsWith("/portal/studies/");
  }
  return current === destination || current.startsWith(`${destination}/`);
}

function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] || "/";
  if (withoutQuery === "/") return withoutQuery;
  return withoutQuery.replace(/\/+$/, "");
}
