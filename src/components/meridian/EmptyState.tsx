import { FileStackIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  icon?: ReactNode;
  title: string;
};

export function EmptyState({ action, className, description, icon, title }: EmptyStateProps) {
  const headingId = `empty-state-${useId().replaceAll(":", "")}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "relative isolate overflow-hidden border border-dashed border-[var(--line-strong)] bg-[var(--paper)] px-6 py-12 text-center sm:px-10 sm:py-16",
        className,
      )}
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-[var(--clay)] opacity-40" />
      <span aria-hidden="true" className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--clay-soft)] text-[var(--clay-strong)] [&_svg]:size-4">
        {icon ?? <FileStackIcon />}
      </span>
      <h2 id={headingId} className="mt-5 text-balance font-[var(--font-editorial)] text-2xl font-medium text-[var(--ink-strong)]">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
      {action ? <div className="mt-6 flex justify-center [&_a]:focus-visible:shadow-[var(--focus-ring)]">{action}</div> : null}
    </section>
  );
}
