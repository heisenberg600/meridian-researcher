"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

const Streamdown = lazy(() =>
  import("streamdown").then((module) => ({ default: module.Streamdown })),
);

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system" | "data";
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-2",
        from === "user"
          ? "is-user ml-auto max-w-[min(76%,36rem)] items-end"
          : "is-assistant items-start",
        className,
      )}
      data-role={from}
      {...props}
    />
  );
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageContent({ className, ...props }: MessageContentProps) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden [font:var(--text-body)]",
        "group-[.is-user]:rounded-[var(--radius-lg)] group-[.is-user]:bg-[var(--ink-900)] group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-[var(--text-inverse)]",
        "group-[.is-assistant]:w-full group-[.is-assistant]:py-1 group-[.is-assistant]:text-[var(--ink-700)]",
        className,
      )}
      {...props}
    />
  );
}

export type MessageResponseProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
};

export function MessageResponse({ children, className, ...props }: MessageResponseProps) {
  return (
    <div className={cn("meridian-markdown", className)} {...props}>
      <Suspense fallback={<span className="whitespace-pre-wrap">{children}</span>}>
        <Streamdown>{children}</Streamdown>
      </Suspense>
    </div>
  );
}

export type MessageActionsProps = ComponentProps<"div">;

export function MessageActions({ className, ...props }: MessageActionsProps) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />;
}
