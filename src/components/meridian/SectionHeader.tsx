import type { ReactNode } from "react";

export interface SectionHeaderProps {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}

export function SectionHeader({ action, description, eyebrow, title }: SectionHeaderProps) {
  return (
    <header className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--clay-strong)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-[var(--font-editorial)] text-3xl font-medium tracking-[-0.025em] text-[var(--ink-strong)] sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div aria-label="Page actions" className="flex shrink-0 items-center gap-2">
          {action}
        </div>
      ) : null}
    </header>
  );
}
