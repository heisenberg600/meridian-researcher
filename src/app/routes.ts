export const workspacePages = [
  "studies",
  "knowledge",
  "memory",
  "brand",
  "activity",
  "billing",
] as const;

export const studyPages = [
  "overview",
  "plan",
  "questionnaire",
  "participants",
  "fieldwork",
  "analysis",
  "report",
  "memory",
] as const;

export type WorkspacePage = (typeof workspacePages)[number];
export type StudyPage = (typeof studyPages)[number];

export type PortalRoute =
  | { kind: "workspace"; page: WorkspacePage }
  | { kind: "study"; page: StudyPage; studyId: string }
  | { kind: "not_found" };

const workspaceRouteMap: Readonly<Record<string, WorkspacePage>> = {
  "/portal": "studies",
  "/portal/knowledge": "knowledge",
  "/portal/memory": "memory",
  "/portal/brand": "brand",
  "/portal/activity": "activity",
  "/portal/billing": "billing",
};

const studyPageAliases: Readonly<Record<string, StudyPage>> = {
  "interview-guide": "questionnaire",
  calls: "fieldwork",
  artifacts: "report",
};

export function parsePortalRoute(pathname: string): PortalRoute {
  const path = normalizePath(pathname);
  const workspacePage = workspaceRouteMap[path];
  if (workspacePage) return { kind: "workspace", page: workspacePage };

  const segments = path.split("/").filter(Boolean);
  if (segments.length !== 4 || segments[0] !== "portal" || segments[1] !== "studies") {
    return { kind: "not_found" };
  }

  let studyId: string;
  try {
    studyId = decodeURIComponent(segments[2] ?? "").trim();
  } catch {
    return { kind: "not_found" };
  }
  if (!studyId) return { kind: "not_found" };

  const rawPage = segments[3] ?? "";
  const page = studyPageAliases[rawPage] ?? (
    studyPages.includes(rawPage as StudyPage) ? rawPage as StudyPage : undefined
  );
  return page ? { kind: "study", page, studyId } : { kind: "not_found" };
}

function normalizePath(value: string) {
  const path = value.split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return path.replace(/\/+$/, "");
}
