import { useId, type FormEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "./Button";

export type MemoryEditorProps = {
  disabled?: boolean;
  label: string;
  name: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  value: string;
};

export function MemoryEditor({ disabled, label, name, onCancel, onChange, onSave, value }: MemoryEditorProps) {
  const inputId = `memory-${useId().replaceAll(":", "")}`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor={inputId} className="block text-xs font-semibold text-[var(--ink-strong)]">
        {label}
      </label>
      <Textarea
        autoComplete="off"
        disabled={disabled}
        id={inputId}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add durable context…"
        rows={4}
        value={value}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || !value.trim()} type="submit">Save memory</Button>
        <Button disabled={disabled} onClick={onCancel} type="button" variant="ghost">Cancel</Button>
      </div>
    </form>
  );
}
