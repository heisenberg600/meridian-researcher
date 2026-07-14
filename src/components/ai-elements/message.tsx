"use client";

import type { ComponentProps, HTMLAttributes } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system" | "data";
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto items-end" : "is-assistant items-start",
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
        "min-w-0 max-w-full overflow-hidden rounded-[var(--radius-lg)] [font:var(--text-body)]",
        "group-[.is-user]:bg-[var(--ink-900)] group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-[var(--text-inverse)]",
        "group-[.is-assistant]:border group-[.is-assistant]:border-[var(--border-default)] group-[.is-assistant]:bg-[var(--surface-card)] group-[.is-assistant]:px-4 group-[.is-assistant]:py-3 group-[.is-assistant]:text-[var(--ink-700)]",
        className,
      )}
      {...props}
    />
  );
}

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export function MessageResponse({ className, ...props }: MessageResponseProps) {
  return <Streamdown className={cn("meridian-markdown", className)} {...props} />;
}

export type MessageActionsProps = ComponentProps<"div">;

export function MessageActions({ className, ...props }: MessageActionsProps) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />;
}
