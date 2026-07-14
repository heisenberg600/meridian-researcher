import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

import { Button, SectionHeader } from "@/components/meridian";
import type { LoadState, MemoryDraft, MemoryItem } from "../context/contracts";
import { MemoryEditor } from "./MemoryEditor";

interface MemoryPageViewProps {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  state: LoadState<MemoryItem[]>;
  onCreate(draft: MemoryDraft): void | Promise<void>;
  onUpdate(itemId: string, patch: Partial<MemoryDraft>): void | Promise<void>;
  onRemove(itemId: string): void | Promise<void>;
  onReload(): void | Promise<void>;
}

export function MemoryPageView({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  state,
  onCreate,
  onUpdate,
  onRemove,
  onReload,
}: MemoryPageViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-[960px] flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} action={state.status !== "loading" ? <Button variant="ghost" size="sm" onClick={() => void onReload()}><RefreshCw aria-hidden="true" />Refresh</Button> : undefined} />

      <aside className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--clay-100)] bg-[var(--clay-50)] p-4">
        <Sparkles aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--clay-700)]" size={18} />
        <p className="[font:var(--text-body-sm)] text-[var(--text-secondary)]">Meridian quietly refreshes this list as source processing and research work finish. You can edit or remove any item directly.</p>
      </aside>

      {state.status === "loading" ? (
        <div role="status" aria-busy="true" className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-6">
          <p className="[font:var(--text-label)] text-[var(--text-heading)]">Loading {title.toLowerCase()}…</p>
          <div aria-hidden="true" className="mt-4 h-28 animate-pulse rounded-[var(--radius-md)] bg-[var(--ivory-200)]" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--red-100)] bg-[var(--red-100)] p-5 sm:flex-row sm:items-center">
          <AlertTriangle aria-hidden="true" className="shrink-0 text-[var(--status-danger)]" size={20} />
          <div className="flex-1"><p className="[font:var(--text-label)] text-[var(--text-heading)]">Memory is unavailable</p><p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{state.message}</p></div>
          <Button variant="secondary" size="sm" onClick={() => void onReload()}>Try again</Button>
        </div>
      ) : null}

      {state.status === "ready" && state.data.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border-strong)] bg-[var(--ivory-50)] px-6 py-10 text-center">
          <Sparkles aria-hidden="true" className="mx-auto text-[var(--clay-700)]" size={26} />
          <h2 className="mt-4 [font:var(--text-display-md)] tracking-[var(--tracking-display)] text-[var(--text-heading)]">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl [font:var(--text-body)] text-[var(--text-secondary)]">{emptyDescription}</p>
          <div className="mx-auto mt-5 max-w-xl text-left"><MemoryEditor items={[]} onCreate={onCreate} onUpdate={onUpdate} onRemove={onRemove} /></div>
        </div>
      ) : null}

      {state.status === "ready" && state.data.length > 0 ? <MemoryEditor items={state.data} onCreate={onCreate} onUpdate={onUpdate} onRemove={onRemove} /> : null}
    </main>
  );
}
