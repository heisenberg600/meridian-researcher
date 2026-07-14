import type { MemoryDraft, MemoryItem } from "../context/contracts";

export type MemoryChange =
  | { type: "create"; item: MemoryItem }
  | { type: "update"; id: string; patch: Partial<MemoryDraft> }
  | { type: "remove"; id: string };

export function applyMemoryChange(items: readonly MemoryItem[], change: MemoryChange): MemoryItem[] {
  if (change.type === "create") return [change.item, ...items];
  if (change.type === "remove") return items.filter((item) => item.id !== change.id);

  return items.map((item) =>
    item.id === change.id
      ? { ...item, ...change.patch }
      : item,
  );
}
