import { FileAudioIcon, FileSpreadsheetIcon, FileTextIcon, Globe2Icon, LinkIcon, LoaderCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SourceKind = "document" | "spreadsheet" | "audio" | "website" | "link";
export type SourceStatus = "queued" | "processing" | "ready" | "failed";

export type SourceRowProps = {
  action?: ReactNode;
  kind: SourceKind;
  meta?: string;
  name: string;
  status: SourceStatus;
};

const sourceIcons = {
  document: FileTextIcon,
  spreadsheet: FileSpreadsheetIcon,
  audio: FileAudioIcon,
  website: Globe2Icon,
  link: LinkIcon,
} as const;

const statusLabels: Record<SourceStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export function SourceRow({ action, kind, meta, name, status }: SourceRowProps) {
  const SourceIcon = sourceIcons[kind];

  return (
    <article className="flex min-w-0 items-center gap-3 border-b border-[var(--line)] px-1 py-4 last:border-b-0">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--paper-soft)] text-[var(--ink-muted)]">
        <SourceIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-[var(--ink-strong)]">{name}</h3>
        {meta ? <p className="mt-0.5 truncate text-xs text-[var(--ink-faint)]">{meta}</p> : null}
      </div>
      <span
        className={cn(
          "inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.6875rem] font-semibold",
          status === "ready" && "bg-[var(--success-soft)] text-[var(--success)]",
          status === "processing" && "bg-[var(--clay-soft)] text-[var(--clay-strong)]",
          status === "queued" && "bg-[var(--paper-soft)] text-[var(--ink-faint)]",
          status === "failed" && "bg-[var(--danger-soft)] text-[var(--danger)]",
        )}
      >
        {status === "processing" ? <LoaderCircleIcon aria-hidden="true" className="size-3 animate-spin motion-reduce:animate-none" /> : null}
        {statusLabels[status]}
      </span>
      {action ? <div className="shrink-0">{action}</div> : null}
    </article>
  );
}
