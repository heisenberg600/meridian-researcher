import {
  ActivityIcon,
  BookOpenTextIcon,
  CreditCardIcon,
  FileStackIcon,
  LandmarkIcon,
  MenuIcon,
  PaletteIcon,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { isShellPathActive, workspaceNavigation } from "./shellNavigation";

export type WorkspaceUser = {
  name: string;
  email?: string;
};

export type WorkspaceShellProps = {
  children: ReactNode;
  currentPath: string;
  header?: ReactNode;
  user?: WorkspaceUser;
  workspaceName: string;
};

type NavigationIcon = ComponentType<SVGProps<SVGSVGElement>>;

const navigationIcons: Record<string, NavigationIcon> = {
  studies: FileStackIcon,
  knowledge: BookOpenTextIcon,
  memory: LandmarkIcon,
  brand: PaletteIcon,
  activity: ActivityIcon,
  billing: CreditCardIcon,
};

export function WorkspaceShell({
  children,
  currentPath,
  header,
  user,
  workspaceName,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--canvas)] text-[var(--ink)] lg:grid lg:grid-cols-[var(--workspace-rail)_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-[var(--radius-control)] bg-[var(--ink-strong)] px-4 py-2 text-sm font-semibold text-[var(--paper)] shadow-[var(--shadow-raised)] transition-transform focus-visible:translate-y-0"
      >
        Skip to main content
      </a>

      <aside className="hidden min-h-dvh border-r border-[var(--line)] bg-[var(--paper-raised)] lg:flex lg:flex-col">
        <WorkspaceIdentity workspaceName={workspaceName} />
        <WorkspaceNavigation currentPath={currentPath} />
        <UserSummary user={user} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--canvas)] px-4 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-top:env(safe-area-inset-top)] lg:hidden">
          <WorkspaceIdentity compact workspaceName={workspaceName} />
          <details className="group relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-3 text-sm font-semibold text-[var(--ink-strong)] outline-none hover:bg-[var(--paper-soft)] focus-visible:shadow-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
              <MenuIcon aria-hidden="true" className="size-4" />
              Menu
            </summary>
            <div className="absolute right-0 mt-2 max-h-[calc(100dvh_-_5rem_-_env(safe-area-inset-top))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain border border-[var(--line)] bg-[var(--paper-raised)] p-2 shadow-[var(--shadow-raised)]">
              <WorkspaceNavigation currentPath={currentPath} mobile />
              <UserSummary mobile user={user} />
            </div>
          </details>
        </header>

        {header ? (
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-4 sm:px-6 lg:px-8">
            {header}
          </div>
        ) : null}

        <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

function WorkspaceIdentity({ workspaceName, compact = false }: { workspaceName: string; compact?: boolean }) {
  return (
    <div className={cn(compact ? "min-w-0" : "border-b border-[var(--line)] px-5 py-6")}>
      <a href="/portal" className="inline-flex items-baseline gap-1 text-[var(--ink-strong)] outline-none focus-visible:shadow-[var(--focus-ring)]">
        <span className="font-[var(--font-editorial)] text-xl font-medium tracking-[-0.02em]">Meridian</span>
        <span aria-hidden="true" className="text-[var(--clay)]">+</span>
      </a>
      <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">{workspaceName}</p>
    </div>
  );
}

function WorkspaceNavigation({ currentPath, mobile = false }: { currentPath: string; mobile?: boolean }) {
  return (
    <nav aria-label="Workspace" className={cn(mobile ? "space-y-1" : "flex-1 px-3 py-5")}>
      {!mobile ? <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.11em] text-[var(--ink-faint)]">Workspace</p> : null}
      <ul className="space-y-1">
        {workspaceNavigation.map((item) => {
          const Icon = navigationIcons[item.id];
          const active = isShellPathActive(currentPath, item.href);
          return (
            <li key={item.id}>
              <a
                aria-current={active ? "page" : undefined}
                href={item.href}
                className={cn(
                  "group flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium outline-none transition-[background-color,color] duration-[var(--duration-fast)] hover:bg-[var(--paper-soft)] focus-visible:shadow-[var(--focus-ring)]",
                  active
                    ? "bg-[var(--paper-soft)] text-[var(--ink-strong)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                )}
              >
                <span>{item.label}</span>
                {Icon ? <Icon aria-hidden="true" className="order-first size-4 shrink-0" /> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function UserSummary({ user, mobile = false }: { user?: WorkspaceUser; mobile?: boolean }) {
  const name = user?.name || "Workspace member";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className={cn("flex items-center gap-3", mobile ? "mt-2 border-t border-[var(--line)] px-3 pt-3" : "border-t border-[var(--line)] px-5 py-4")}>
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--clay-soft)] text-xs font-semibold text-[var(--clay-strong)]">
        {initials || "M"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--ink-strong)]">{name}</p>
        {user?.email ? <p className="truncate text-xs text-[var(--ink-faint)]">{user.email}</p> : null}
      </div>
    </div>
  );
}
