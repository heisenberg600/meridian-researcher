import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SheetGridProps = {
  caption: string;
  children?: ReactNode;
  className?: string;
  columns: readonly string[];
};

export function SheetGrid({ caption, children, className, columns }: SheetGridProps) {
  return (
    <div
      aria-label={caption}
      role="region"
      tabIndex={0}
      className={cn(
        "max-w-full overflow-x-auto border border-[var(--line)] bg-[var(--paper-raised)] outline-none focus-visible:shadow-[var(--focus-ring)]",
        className,
      )}
    >
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[var(--paper-soft)] text-[0.6875rem] uppercase tracking-[0.08em] text-[var(--ink-faint)]">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="border-b border-[var(--line)] px-4 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)] [&_td]:px-4 [&_td]:py-3">{children}</tbody>
      </table>
    </div>
  );
}
