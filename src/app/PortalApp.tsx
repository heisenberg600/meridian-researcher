import type { ReactNode } from "react";
import { StudyShell, type StudyNextAction, type StudySummary } from "./StudyShell";
import { WorkspaceShell, type WorkspaceUser } from "./WorkspaceShell";

export type PortalAppProps = {
  children: ReactNode;
  currentPath: string;
  header?: ReactNode;
  nextAction?: StudyNextAction;
  study?: StudySummary;
  user?: WorkspaceUser;
  workspaceName: string;
};

/**
 * Route-independent authenticated composition. The lead-owned route registry
 * resolves the current page and passes it here; this component does not read or
 * mutate browser history.
 */
export function PortalApp({
  children,
  currentPath,
  header,
  nextAction,
  study,
  user,
  workspaceName,
}: PortalAppProps) {
  return (
    <WorkspaceShell
      currentPath={currentPath}
      header={study ? undefined : header}
      user={user}
      workspaceName={workspaceName}
    >
      {study ? (
        <StudyShell currentPath={currentPath} nextAction={nextAction} study={study}>
          {children}
        </StudyShell>
      ) : (
        children
      )}
    </WorkspaceShell>
  );
}
