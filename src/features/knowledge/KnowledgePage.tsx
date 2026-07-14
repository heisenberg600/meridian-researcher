import { AlertTriangle, FileAudio, FileText, FileVideo, Globe2, Presentation, RefreshCw, Sheet, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge, Button, SectionHeader } from "@/components/meridian";
import {
  type KnowledgeAdapter,
  type KnowledgeLinkInput,
  type KnowledgeScope,
  type KnowledgeSource,
  type LoadState,
} from "../context/contracts";
import { useAdapterResource } from "../context/useAdapterResource";
import { SourceUploader } from "./SourceUploader";

interface KnowledgePageProps {
  adapter: KnowledgeAdapter;
  scope: KnowledgeScope;
}

export function KnowledgePage({ adapter, scope }: KnowledgePageProps) {
  const load = useCallback(() => adapter.listSources(scope), [adapter, scope]);
  const { state, reload } = useAdapterResource(load);
  const [actionMessage, setActionMessage] = useState<string>();

  async function run(action: () => Promise<unknown>, successMessage: string) {
    setActionMessage(undefined);
    try {
      await action();
      setActionMessage(successMessage);
      await reload();
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : "The source could not be updated.");
    }
  }

  return (
    <KnowledgePageView
      scope={scope}
      state={state}
      actionMessage={actionMessage}
      onAddLink={(input) => run(() => adapter.addLink(scope, input), "Source added. Processing has started.")}
      onAddFiles={(files) => run(() => adapter.addFiles(scope, files), "Files uploaded. Processing has started.")}
      onRetry={(id) => run(() => adapter.retrySource(id), "Source queued for another attempt.")}
      onRemove={(id) => run(() => adapter.removeSource(id), "Source removed.")}
      onReload={reload}
    />
  );
}

interface KnowledgePageViewProps {
  scope: KnowledgeScope;
  state: LoadState<KnowledgeSource[]>;
  actionMessage?: string;
  onAddLink(input: KnowledgeLinkInput): void | Promise<void>;
  onAddFiles(files: readonly File[]): void | Promise<void>;
  onRetry(sourceId: string): void | Promise<void>;
  onRemove(sourceId: string): void | Promise<void>;
  onReload(): void | Promise<void>;
}

export function KnowledgePageView({
  scope,
  state,
  actionMessage,
  onAddLink,
  onAddFiles,
  onRetry,
  onRemove,
  onReload,
}: KnowledgePageViewProps) {
  const isCompany = scope.kind === "company";
  const title = isCompany ? "Company knowledge" : `${scope.studyName ?? "Study"} knowledge`;
  const description = isCompany
    ? "Sources here shape company memory and give every new study a reliable starting point."
    : "Sources here stay inside this study and inform its plan, questionnaire, and analysis.";

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <SectionHeader eyebrow={isCompany ? "Workspace context" : "Study context"} title={title} description={description} />

      <SourceUploader onAddLink={onAddLink} onAddFiles={onAddFiles} />

      {actionMessage ? (
        <p role="status" className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--ivory-100)] px-4 py-3 [font:var(--text-body-sm)] text-[var(--text-secondary)]">
          {actionMessage}
        </p>
      ) : null}

      <section aria-labelledby="source-library-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="[font:var(--text-caption)] uppercase tracking-[var(--tracking-caps)] text-[var(--text-muted)]">Source library</p>
            <h2 id="source-library-title" className="mt-1 [font:var(--text-heading-sm)] text-[var(--text-heading)]">
              {state.status === "ready" ? `${state.data.length} ${state.data.length === 1 ? "source" : "sources"}` : "Sources"}
            </h2>
          </div>
          {state.status !== "loading" ? <Button variant="ghost" size="sm" onClick={() => void onReload()}><RefreshCw aria-hidden="true" />Refresh</Button> : null}
        </div>

        {state.status === "loading" ? <KnowledgeLoading title={title} /> : null}
        {state.status === "error" ? <KnowledgeError message={state.message} onReload={onReload} /> : null}
        {state.status === "ready" && state.data.length === 0 ? <KnowledgeEmpty /> : null}
        {state.status === "ready" && state.data.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-xs)]">
            <ul className="divide-y divide-[var(--border-default)]">
              {state.data.map((source) => <SourceRow key={source.id} source={source} onRetry={onRetry} onRemove={onRemove} />)}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function KnowledgeLoading({ title }: { title: string }) {
  return (
    <div role="status" aria-busy="true" className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-6">
      <p className="[font:var(--text-label)] text-[var(--text-heading)]">Loading {title.toLowerCase()}…</p>
      <div aria-hidden="true" className="mt-4 space-y-3">
        <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[var(--ivory-200)]" />
        <div className="h-12 animate-pulse rounded-[var(--radius-md)] bg-[var(--ivory-200)]" />
      </div>
    </div>
  );
}

function KnowledgeError({ message, onReload }: { message: string; onReload(): void | Promise<void> }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--red-100)] bg-[var(--red-100)] p-5 sm:flex-row sm:items-center">
      <AlertTriangle aria-hidden="true" className="shrink-0 text-[var(--status-danger)]" size={20} />
      <div className="flex-1"><p className="[font:var(--text-label)] text-[var(--text-heading)]">Knowledge is unavailable</p><p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{message}</p></div>
      <Button variant="secondary" size="sm" onClick={() => void onReload()}>Try again</Button>
    </div>
  );
}

function KnowledgeEmpty() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border-strong)] bg-[var(--ivory-50)] px-6 py-10 text-center">
      <Globe2 aria-hidden="true" className="mx-auto text-[var(--clay-700)]" size={26} />
      <h3 className="mt-4 [font:var(--text-display-md)] tracking-[var(--tracking-display)] text-[var(--text-heading)]">Give every study a reliable starting point</h3>
      <p className="mx-auto mt-2 max-w-xl [font:var(--text-body)] text-[var(--text-secondary)]">Add a website or public media link, or upload source files. Processing status stays visible here while Meridian builds company context.</p>
    </div>
  );
}

const toneByStatus = {
  queued: "neutral",
  processing: "warning",
  ready: "success",
  failed: "danger",
} as const;

const labelByStatus = { queued: "Queued", processing: "Processing", ready: "Ready", failed: "Failed" } as const;

function SourceRow({
  source,
  onRetry,
  onRemove,
}: {
  source: KnowledgeSource;
  onRetry(sourceId: string): void | Promise<void>;
  onRemove(sourceId: string): void | Promise<void>;
}) {
  const icon = sourceIcon(source.kind);
  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <span className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--ivory-200)] text-[var(--text-secondary)]">{icon}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate [font:var(--text-label)] text-[var(--text-heading)]">{source.name}</p>
          <Badge tone={toneByStatus[source.status]}>{labelByStatus[source.status]}</Badge>
        </div>
        <p className="mt-1 [font:var(--text-body-sm)] text-[var(--text-secondary)]">{source.statusMessage}</p>
        {source.error ? <p className="mt-1 [font:var(--text-body-sm)] text-[var(--status-danger)]">{source.error}</p> : null}
      </div>
      <div className="flex items-center gap-1 sm:justify-end">
        {source.status === "failed" ? <Button variant="secondary" size="sm" onClick={() => void onRetry(source.id)}>Retry</Button> : null}
        <Button variant="ghost" size="icon" aria-label={`Remove ${source.name}`} onClick={() => void onRemove(source.id)}><Trash2 aria-hidden="true" /></Button>
      </div>
    </li>
  );
}

function sourceIcon(kind: KnowledgeSource["kind"]) {
  if (kind === "website" || kind === "media_link") return <Globe2 aria-hidden="true" size={17} />;
  if (kind === "spreadsheet") return <Sheet aria-hidden="true" size={17} />;
  if (kind === "presentation") return <Presentation aria-hidden="true" size={17} />;
  if (kind === "audio") return <FileAudio aria-hidden="true" size={17} />;
  if (kind === "video") return <FileVideo aria-hidden="true" size={17} />;
  return <FileText aria-hidden="true" size={17} />;
}
