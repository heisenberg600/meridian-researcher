import { QuoteIcon } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type EvidenceLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "href"> & {
  href: string;
  label: string;
  locator?: string;
};

export function EvidenceLink({ className, href, label, locator, ...props }: EvidenceLinkProps) {
  if (!href.trim()) return null;

  const accessibleLabel = locator ? `View evidence from ${label} at ${locator}` : `View evidence from ${label}`;

  return (
    <a
      aria-label={accessibleLabel}
      href={href}
      className={cn(
        "inline-flex min-h-8 max-w-full items-center gap-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--paper-raised)] px-2.5 text-xs font-semibold text-[var(--ink)] outline-none transition-[border-color,background-color] hover:border-[var(--clay)] hover:bg-[var(--clay-wash)] focus-visible:shadow-[var(--focus-ring)]",
        className,
      )}
      {...props}
    >
      <QuoteIcon aria-hidden="true" className="size-3.5 shrink-0 text-[var(--clay-strong)]" />
      <span className="truncate">{label}</span>
      {locator ? <span className="shrink-0 font-[var(--font-data)] text-[var(--ink-faint)]">{locator}</span> : null}
    </a>
  );
}
