import { FileUp, Globe2, Link2 } from "lucide-react";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import { Button, TextInput } from "@/components/meridian";
import {
  normalizeKnowledgeLink,
  supportedKnowledgeFile,
  type KnowledgeLinkInput,
} from "../context/contracts";

interface SourceUploaderProps {
  onAddLink(input: KnowledgeLinkInput): void | Promise<void>;
  onAddFiles(files: readonly File[]): void | Promise<void>;
  disabled?: boolean;
}

export function SourceUploader({ onAddLink, onAddFiles, disabled = false }: SourceUploaderProps) {
  const linkId = useId();
  const fileId = useId();
  const [linkKind, setLinkKind] = useState<KnowledgeLinkInput["kind"]>("website");
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState<string>();
  const [files, setFiles] = useState<readonly File[]>([]);
  const [fileError, setFileError] = useState<string>();
  const [submitting, setSubmitting] = useState<"link" | "files" | null>(null);

  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkError(undefined);
    try {
      const input = normalizeKnowledgeLink(linkKind, url);
      setSubmitting("link");
      await onAddLink(input);
      setUrl("");
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : "Could not add this link.");
    } finally {
      setSubmitting(null);
    }
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const unsupported = selected.filter((file) => !supportedKnowledgeFile(file.name));
    if (unsupported.length) {
      setFiles([]);
      setFileError(`Unsupported file: ${unsupported[0]?.name}. Choose a document, spreadsheet, audio, or video file.`);
      return;
    }
    setFileError(undefined);
    setFiles(selected);
  }

  async function submitFiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length) {
      setFileError("Choose at least one source file.");
      return;
    }
    setSubmitting("files");
    setFileError(undefined);
    try {
      await onAddFiles(files);
      setFiles([]);
    } catch (cause) {
      setFileError(cause instanceof Error ? cause.message : "Could not upload these files.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section aria-labelledby="add-sources-title" className="grid gap-4 lg:grid-cols-2">
      <h2 id="add-sources-title" className="sr-only">Add knowledge sources</h2>

      <form onSubmit={submitLink} className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-xs)]">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--clay-700)]">
            {linkKind === "website" ? <Globe2 aria-hidden="true" size={18} /> : <Link2 aria-hidden="true" size={18} />}
          </span>
          <div>
            <h3 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Add a website or public media link</h3>
            <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">Meridian reads public pages and media transcripts in the background.</p>
          </div>
        </div>

        <fieldset className="mb-3 flex gap-2">
          <legend className="sr-only">Link type</legend>
          {(["website", "media_link"] as const).map((kind) => (
            <label key={kind} className="cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name={`${linkId}-kind`}
                value={kind}
                checked={linkKind === kind}
                onChange={() => setLinkKind(kind)}
                disabled={disabled}
              />
              <span className="inline-flex h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-page)] px-3 [font:var(--text-body-sm)] text-[var(--text-secondary)] peer-checked:border-[var(--ink-900)] peer-checked:bg-[var(--ink-900)] peer-checked:text-[var(--ivory-100)] peer-focus-visible:shadow-[var(--focus-ring)]">
                {kind === "website" ? "Website" : "Public media"}
              </span>
            </label>
          ))}
        </fieldset>

        <label htmlFor={linkId} className="mb-1.5 block [font:var(--text-label)] text-[var(--text-heading)]">Public URL</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            id={linkId}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={linkKind === "website" ? "yourcompany.com" : "https://youtube.com/watch…"}
            aria-describedby={linkError ? `${linkId}-error` : undefined}
            aria-invalid={Boolean(linkError)}
            disabled={disabled || submitting !== null}
          />
          <Button type="submit" variant="secondary" disabled={disabled || submitting !== null}>
            {submitting === "link" ? "Adding…" : "Add link"}
          </Button>
        </div>
        {linkError ? <p id={`${linkId}-error`} role="alert" className="mt-2 [font:var(--text-body-sm)] text-[var(--status-danger)]">{linkError}</p> : null}
      </form>

      <form onSubmit={submitFiles} className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-xs)]">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ivory-200)] text-[var(--text-secondary)]">
            <FileUp aria-hidden="true" size={18} />
          </span>
          <div>
            <h3 className="[font:var(--text-heading-sm)] text-[var(--text-heading)]">Upload source files</h3>
            <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">PDF, slides, documents, spreadsheets, audio, and video.</p>
          </div>
        </div>

        <label htmlFor={fileId} className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-page)] px-4 py-5 text-center transition-colors hover:bg-[var(--ivory-200)] focus-within:shadow-[var(--focus-ring)]">
          <input
            id={fileId}
            type="file"
            multiple
            className="sr-only"
            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,audio/*,video/*"
            onChange={chooseFiles}
            disabled={disabled || submitting !== null}
          />
          <span className="[font:var(--text-label)] text-[var(--text-heading)]">{files.length ? `${files.length} ${files.length === 1 ? "file" : "files"} selected` : "Choose files"}</span>
          <span className="mt-1 [font:var(--text-body-sm)] text-[var(--text-muted)]">Source processing continues if you leave this page.</span>
        </label>
        {fileError ? <p role="alert" className="mt-2 [font:var(--text-body-sm)] text-[var(--status-danger)]">{fileError}</p> : null}
        <Button className="mt-3 w-full sm:w-auto" type="submit" variant="secondary" disabled={disabled || submitting !== null}>
          {submitting === "files" ? "Uploading…" : "Upload files"}
        </Button>
      </form>
    </section>
  );
}
