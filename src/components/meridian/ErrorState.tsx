import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";

export type ErrorStateProps = {
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  title: string;
};

export function ErrorState({ description, onRetry, retryLabel = "Try again", title }: ErrorStateProps) {
  return (
    <section role="alert" className="mx-auto max-w-xl border border-[var(--danger-line)] bg-[var(--paper-raised)] p-6 sm:p-8">
      <AlertTriangleIcon aria-hidden="true" className="size-5 text-[var(--danger)]" />
      <h2 className="mt-4 font-[var(--font-editorial)] text-2xl font-medium text-[var(--ink-strong)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--ink-strong)] px-4 text-sm font-semibold text-[var(--paper)] outline-none hover:bg-[var(--clay-strong)] focus-visible:shadow-[var(--focus-ring)]"
        >
          <RotateCcwIcon aria-hidden="true" className="size-4" />
          {retryLabel}
        </button>
      ) : null}
    </section>
  );
}
