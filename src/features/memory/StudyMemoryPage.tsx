import { useCallback, useMemo } from "react";

import type { LoadState, MemoryAdapter, MemoryDraft, MemoryItem } from "../context/contracts";
import { useAdapterResource } from "../context/useAdapterResource";
import { MemoryPageView } from "./MemoryPage";

export function StudyMemoryPage({ adapter, studyId, studyName }: { adapter: MemoryAdapter; studyId: string; studyName: string }) {
  const scope = useMemo(() => ({ kind: "study" as const, studyId, studyName }), [studyId, studyName]);
  const load = useCallback(() => adapter.listMemory(scope), [adapter, scope]);
  const { state, reload } = useAdapterResource(load);

  return <StudyMemoryPageView studyName={studyName} state={state} onCreate={async (draft) => { await adapter.createMemory(scope, draft); await reload(); }} onUpdate={async (id, patch) => { await adapter.updateMemory(id, patch); await reload(); }} onRemove={async (id) => { await adapter.removeMemory(id); await reload(); }} onReload={reload} />;
}

interface StudyMemoryPageViewProps {
  studyName: string;
  state: LoadState<MemoryItem[]>;
  onCreate(draft: MemoryDraft): void | Promise<void>;
  onUpdate(itemId: string, patch: Partial<MemoryDraft>): void | Promise<void>;
  onRemove(itemId: string): void | Promise<void>;
  onReload(): void | Promise<void>;
}

export function StudyMemoryPageView({ studyName, ...props }: StudyMemoryPageViewProps) {
  return <MemoryPageView {...props} eyebrow="Study context" title={`${studyName} memory`} description="Working context for only this study. The strategist and analyst can use it; other studies cannot." emptyTitle="Give this study a working memory" emptyDescription="Add the decision, constraints, or customer language that should remain available throughout this study." />;
}
