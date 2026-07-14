import type { ReactNode } from "react";

export type PageHeaderProps = {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

export function PageHeader({ action, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.11em] text-[var(--clay-strong)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-balance font-[var(--font-editorial)] text-3xl font-medium tracking-[-0.025em] text-[var(--ink-strong)] sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-3xl text-pretty text-sm leading-6 text-[var(--ink-muted)]">{description}</p> : null}
      </div>
      {action ? <div aria-label="Page actions" className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
