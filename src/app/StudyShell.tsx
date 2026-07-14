import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getStudyNavigation, isShellPathActive } from "./shellNavigation";

export type StudySummary = {
  id: string;
  title: string;
  status: string;
};

export type StudyNextAction = {
  description: string;
  href: string;
  label: string;
};

export type StudyShellProps = {
  children: ReactNode;
  currentPath: string;
  nextAction?: StudyNextAction;
  study: StudySummary;
};

export function StudyShell({ children, currentPath, nextAction, study }: StudyShellProps) {
  const navigation = getStudyNavigation(study.id);

  return (
    <section aria-labelledby="study-title" className="min-h-[calc(100dvh-4rem)] bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="mx-auto max-w-[96rem] px-4 pb-5 pt-5 sm:px-6 lg:px-8 lg:pb-6">
          <a
            href="/portal"
            className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] text-xs font-semibold text-[var(--ink-muted)] outline-none hover:text-[var(--ink-strong)] focus-visible:shadow-[var(--focus-ring)]"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
            All studies
          </a>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 id="study-title" className="text-balance font-[var(--font-editorial)] text-3xl font-medium tracking-[-0.025em] text-[var(--ink-strong)] sm:text-4xl">
                  {study.title}
                </h1>
                <span className="inline-flex min-h-6 items-center rounded-full bg-[var(--clay-soft)] px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--clay-strong)]">
                  {formatStatus(study.status)}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
                Keep the chain from research decision to participant evidence visible as the study moves forward.
              </p>
            </div>

            {nextAction ? (
              <aside aria-label="Next action" className="max-w-xl border-l-2 border-[var(--clay)] pl-4">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--clay-strong)]">Next action</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{nextAction.description}</p>
                <a href={nextAction.href} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] text-sm font-semibold text-[var(--ink-strong)] outline-none hover:text-[var(--clay-strong)] focus-visible:shadow-[var(--focus-ring)]">
                  {nextAction.label}
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </a>
              </aside>
            ) : null}
          </div>
        </div>

        <nav aria-label="Study" className="overflow-x-auto px-4 sm:px-6 lg:px-8">
          <ol aria-label="Study progress" className="mx-auto flex min-w-max max-w-[96rem] items-stretch gap-1">
            {navigation.map((item, index) => {
              const active = isShellPathActive(currentPath, item.href);
              return (
                <li key={item.id} className="flex items-center">
                  <a
                    aria-current={active ? "page" : undefined}
                    href={item.href}
                    className={cn(
                      "group flex min-h-12 items-center gap-2 border-b-2 px-2.5 text-xs font-semibold outline-none transition-[border-color,color] duration-[var(--duration-fast)] focus-visible:shadow-[var(--focus-ring)] sm:px-3",
                      active
                        ? "border-[var(--clay)] text-[var(--ink-strong)]"
                        : "border-transparent text-[var(--ink-faint)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]",
                    )}
                  >
                    <span aria-hidden="true" className={cn("font-[var(--font-data)] text-[0.625rem]", active && "text-[var(--clay-strong)]")}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
    </section>
  );
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}
