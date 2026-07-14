"use client";

import type { ComponentProps } from "react";
import { ArrowUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type PromptInputProps = ComponentProps<"form">;

export function PromptInput({ className, ...props }: PromptInputProps) {
  return (
    <form
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-xs)] focus-within:border-[var(--border-focus)] focus-within:shadow-[var(--focus-ring)]",
        className,
      )}
      {...props}
    />
  );
}

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export function PromptInputTextarea({ className, style, ...props }: PromptInputTextareaProps) {
  return (
    <Textarea
      className={cn(
        "min-h-10 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:shadow-none",
        className,
      )}
      style={{ minHeight: "2.5rem", ...style }}
      rows={1}
      {...props}
    />
  );
}

export type PromptInputToolbarProps = ComponentProps<"div">;

export function PromptInputToolbar({ className, ...props }: PromptInputToolbarProps) {
  return <div className={cn("mt-2 flex min-h-9 items-center gap-2", className)} {...props} />;
}

export type PromptInputToolsProps = ComponentProps<"div">;

export function PromptInputTools({ className, ...props }: PromptInputToolsProps) {
  return <div className={cn("flex items-center gap-1", className)} {...props} />;
}

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: "ready" | "submitted" | "streaming" | "error";
};

export function PromptInputSubmit({
  children,
  className,
  disabled,
  status = "ready",
  ...props
}: PromptInputSubmitProps) {
  return (
    <Button
      aria-label="Send message"
      className={cn("ml-auto size-9 rounded-[var(--radius-full)]", className)}
      disabled={disabled || status === "submitted" || status === "streaming"}
      size="icon"
      type="submit"
      {...props}
    >
      {children ?? <ArrowUpIcon className="size-4" />}
    </Button>
  );
}
