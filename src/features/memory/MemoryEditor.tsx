import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge, Button, TextInput, Textarea } from "@/components/meridian";
import type { MemoryCategory, MemoryDraft, MemoryItem } from "../context/contracts";

interface MemoryEditorProps {
  items: readonly MemoryItem[];
  onCreate(draft: MemoryDraft): void | Promise<void>;
  onUpdate(itemId: string, patch: Partial<MemoryDraft>): void | Promise<void>;
  onRemove(itemId: string): void | Promise<void>;
}

const categories: MemoryCategory[] = ["company", "product", "audience", "market", "decision", "method", "study", "other"];

export function MemoryEditor({ items, onCreate, onUpdate, onRemove }: MemoryEditorProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("company");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function reset() {
    setAdding(false);
    setEditingId(undefined);
    setKey("");
    setValue("");
    setCategory("company");
    setError(undefined);
  }

  function beginEdit(item: MemoryItem) {
    setAdding(false);
    setEditingId(item.id);
    setKey(item.key);
    setValue(item.value);
    setCategory(item.category);
    setError(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!key.trim() || !value.trim()) {
      setError("Add both a short label and what Meridian should remember.");
      return;
    }
    setSaving(true);
    setError(undefined);
    const draft = { key: key.trim(), value: value.trim(), category };
    try {
      if (editingId) await onUpdate(editingId, draft);
      else await onCreate(draft);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Memory could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => { reset(); setAdding(true); }} disabled={adding || Boolean(editingId)}>
          <Plus aria-hidden="true" />Add memory
        </Button>
      </div>

      {adding ? <MemoryForm mode="create" keyValue={key} value={value} category={category} error={error} saving={saving} onKey={setKey} onValue={setValue} onCategory={setCategory} onSubmit={submit} onCancel={reset} /> : null}

      <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-xs)]">
        {items.map((item) => (
          <li key={item.id} className="border-b border-[var(--border-default)] last:border-b-0">
            {editingId === item.id ? (
              <div className="p-4 sm:p-5">
                <MemoryForm mode="edit" keyValue={key} value={value} category={category} error={error} saving={saving} onKey={setKey} onValue={setValue} onCategory={setCategory} onSubmit={submit} onCancel={reset} />
              </div>
            ) : (
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(150px,0.65fr)_minmax(0,1.5fr)_auto] sm:items-start sm:px-5">
                <div>
                  <Badge>{categoryLabel(item.category)}</Badge>
                  <p className="mt-2 [font:var(--text-label)] text-[var(--text-heading)]">{item.key}</p>
                </div>
                <p className="[font:var(--text-body)] text-[var(--text-body)]">{item.value}</p>
                <div className="flex items-center gap-1 sm:justify-end">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${item.key}`} onClick={() => beginEdit(item)}><Pencil aria-hidden="true" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${item.key}`} onClick={() => void onRemove(item.id)}><Trash2 aria-hidden="true" /></Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemoryForm({
  mode,
  keyValue,
  value,
  category,
  error,
  saving,
  onKey,
  onValue,
  onCategory,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  keyValue: string;
  value: string;
  category: MemoryCategory;
  error?: string;
  saving: boolean;
  onKey(value: string): void;
  onValue(value: string): void;
  onCategory(value: MemoryCategory): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  onCancel(): void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[minmax(160px,0.65fr)_minmax(0,1.5fr)]">
        <div>
          <label htmlFor={`${mode}-memory-key`} className="mb-1.5 block [font:var(--text-label)] text-[var(--text-heading)]">Short label</label>
          <TextInput id={`${mode}-memory-key`} value={keyValue} onChange={(event) => onKey(event.target.value)} placeholder="e.g. Target customer" disabled={saving} />
        </div>
        <div>
          <label htmlFor={`${mode}-memory-value`} className="mb-1.5 block [font:var(--text-label)] text-[var(--text-heading)]">What Meridian should remember</label>
          <Textarea id={`${mode}-memory-value`} value={value} onChange={(event) => onValue(event.target.value)} placeholder="A concise fact the agents can use." disabled={saving} />
        </div>
      </div>
      <fieldset className="mt-4">
        <legend className="mb-2 [font:var(--text-label)] text-[var(--text-heading)]">Category</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((option) => (
            <label key={option} className="cursor-pointer">
              <input className="peer sr-only" type="radio" name={`${mode}-memory-category`} value={option} checked={category === option} onChange={() => onCategory(option)} disabled={saving} />
              <span className="inline-flex h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-page)] px-3 [font:var(--text-body-sm)] text-[var(--text-secondary)] peer-checked:border-[var(--ink-900)] peer-checked:bg-[var(--ink-900)] peer-checked:text-[var(--ivory-100)] peer-focus-visible:shadow-[var(--focus-ring)]">{categoryLabel(option)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error ? <p role="alert" className="mt-3 [font:var(--text-body-sm)] text-[var(--status-danger)]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={saving}><X aria-hidden="true" />Cancel</Button>
        <Button type="submit" disabled={saving}><Check aria-hidden="true" />{saving ? "Saving…" : mode === "edit" ? "Save change" : "Add to memory"}</Button>
      </div>
    </form>
  );
}

function categoryLabel(category: MemoryCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
