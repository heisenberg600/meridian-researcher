import { DownloadIcon, FileTextIcon, PresentationIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge, Button, Card, SectionHeader, Textarea } from "@/components/meridian";

type ReportSection = { key: string; title: string; body: string };
type ReportFormat = "pdf" | "pptx";
type Report = {
  id: string;
  status: string;
  brandName: string;
  sections: ReportSection[];
  availableFormats: ReportFormat[];
};

export function ReportPage({
  report,
  busy = false,
  onGenerate,
  onSaveSection,
  onPublish,
  onDownload,
}: {
  report: Report | null;
  busy?: boolean;
  onGenerate: () => void;
  onSaveSection: (key: string, body: string) => void;
  onPublish: () => void;
  onDownload: (format: ReportFormat) => void;
}) {
  if (!report) {
    return (
      <div>
        <SectionHeader eyebrow="Decision-ready output" title="Branded report" description="Generate one editable research narrative from the latest evidence-backed analysis snapshot." />
        <Card className="mt-6 border-dashed p-10 text-center">
          <FileTextIcon className="mx-auto size-6 text-[var(--accent-active)]" />
          <h2 className="mt-3 [font:var(--text-heading-sm)] text-[var(--text-heading)]">No report draft yet</h2>
          <p className="mx-auto mt-2 max-w-xl [font:var(--text-body-sm)] text-[var(--text-secondary)]">Meridian will freeze the current analysis and brand profile, then create editable sections for the final PDF and presentation.</p>
          <Button className="mt-6" onClick={onGenerate} disabled={busy}>{busy ? "Generating…" : "Generate branded report"}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader eyebrow={report.brandName} title="Research report" description="Edit the narrative once, then export the same approved evidence chain to PDF or PowerPoint." />
        <div className="flex flex-wrap gap-2">
          <Badge tone={report.status === "published" ? "success" : "warning"}>{report.status}</Badge>
          {report.availableFormats.includes("pdf") ? <Button variant="outline" onClick={() => onDownload("pdf")}><DownloadIcon className="size-4" />Download PDF</Button> : null}
          {report.availableFormats.includes("pptx") ? <Button variant="outline" onClick={() => onDownload("pptx")}><PresentationIcon className="size-4" />Download PPTX</Button> : null}
          {report.status !== "published" ? <Button onClick={onPublish}>Publish report</Button> : null}
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        {report.sections.map((section, index) => (
          <ReportSectionEditor key={section.key} section={section} index={index} onSave={onSaveSection} />
        ))}
      </div>
    </div>
  );
}

function ReportSectionEditor({ section, index, onSave }: { section: ReportSection; index: number; onSave: (key: string, body: string) => void }) {
  const [body, setBody] = useState(section.body);
  useEffect(() => setBody(section.body), [section.body]);
  return (
    <Card className="grid gap-4 p-5 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-start">
      <div>
        <p className="font-mono text-xs text-[var(--accent-active)]">{String(index + 1).padStart(2, "0")}</p>
        <h2 className="mt-2 [font:var(--text-body)] font-semibold text-[var(--text-heading)]">{section.title}</h2>
      </div>
      <Textarea aria-label={section.title} value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28" />
      <Button variant="outline" disabled={body === section.body || !body.trim()} onClick={() => onSave(section.key, body.trim())}>Save {section.title}</Button>
    </Card>
  );
}
