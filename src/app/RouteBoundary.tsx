import { AlertTriangleIcon, LoaderCircleIcon, RotateCcwIcon } from "lucide-react";
import type { ReactNode } from "react";

type LoadingRouteState = {
  status: "loading";
  label?: string;
};

type ErrorRouteState = {
  status: "error";
  title?: string;
  description?: string;
  onRetry?: () => void;
};

type ReadyRouteState = {
  status: "ready";
};

export type RouteState = LoadingRouteState | ErrorRouteState | ReadyRouteState;

export function RouteBoundary({ children, state }: { children?: ReactNode; state: RouteState }) {
  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex min-h-[22rem] items-center justify-center px-6 py-16 text-center">
        <div>
          <LoaderCircleIcon aria-hidden="true" className="mx-auto size-5 animate-spin text-[var(--clay)] motion-reduce:animate-none" />
          <p className="mt-3 text-sm text-[var(--ink-muted)]">{state.label ?? "Loading workspace"}…</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <section role="alert" className="mx-auto my-12 max-w-xl border border-[var(--danger-line)] bg-[var(--paper-raised)] p-6 sm:p-8">
        <AlertTriangleIcon aria-hidden="true" className="size-5 text-[var(--danger)]" />
        <h2 className="mt-4 font-[var(--font-editorial)] text-2xl font-medium text-[var(--ink-strong)]">
          {state.title ?? "This page could not load"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {state.description ?? "Try again. If the problem continues, return to Studies and reopen this page."}
        </p>
        {state.onRetry ? (
          <button
            type="button"
            onClick={state.onRetry}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--ink-strong)] px-4 text-sm font-semibold text-[var(--paper)] outline-none hover:bg-[var(--clay-strong)] focus-visible:shadow-[var(--focus-ring)]"
          >
            <RotateCcwIcon aria-hidden="true" className="size-4" />
            Try again
          </button>
        ) : null}
      </section>
    );
  }

  return children;
}
