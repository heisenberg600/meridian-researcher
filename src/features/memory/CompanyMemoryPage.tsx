import { useCallback } from "react";

import type { LoadState, MemoryAdapter, MemoryDraft, MemoryItem } from "../context/contracts";
import { useAdapterResource } from "../context/useAdapterResource";
import { MemoryPageView } from "./MemoryPage";

export function CompanyMemoryPage({ adapter }: { adapter: MemoryAdapter }) {
  const scope = { kind: "company" } as const;
  const load = useCallback(() => adapter.listMemory(scope), [adapter]);
  const { state, reload } = useAdapterResource(load);

  return <CompanyMemoryPageView state={state} onCreate={async (draft) => { await adapter.createMemory(scope, draft); await reload(); }} onUpdate={async (id, patch) => { await adapter.updateMemory(id, patch); await reload(); }} onRemove={async (id) => { await adapter.removeMemory(id); await reload(); }} onReload={reload} />;
}

interface CompanyMemoryPageViewProps {
  state: LoadState<MemoryItem[]>;
  onCreate(draft: MemoryDraft): void | Promise<void>;
  onUpdate(itemId: string, patch: Partial<MemoryDraft>): void | Promise<void>;
  onRemove(itemId: string): void | Promise<void>;
  onReload(): void | Promise<void>;
}

export function CompanyMemoryPageView(props: CompanyMemoryPageViewProps) {
  return <MemoryPageView {...props} eyebrow="Workspace context" title="Company memory" description="A simple, editable record of what Meridian knows about your company. It is shared with every study." emptyTitle="Start with what your team already knows" emptyDescription="Add a clear fact now, or let Meridian build this list as company sources become ready." />;
}
