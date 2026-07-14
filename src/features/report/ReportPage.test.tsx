import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReportPage } from "./ReportPage";

describe("ReportPage", () => {
  it("generates the first report from an analysis snapshot", () => {
    const onGenerate = vi.fn();
    render(<ReportPage report={null} onGenerate={onGenerate} onSaveSection={vi.fn()} onPublish={vi.fn()} onDownload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate branded report/i }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("edits sections and exposes both branded export formats", () => {
    const onSaveSection = vi.fn();
    const onDownload = vi.fn();
    render(<ReportPage report={{ id: "report-1", status: "draft", brandName: "Atlas", sections: [{ key: "executive_decision", title: "Executive decision", body: "Choose the focused launch." }], availableFormats: ["pdf", "pptx"] }} onGenerate={vi.fn()} onSaveSection={onSaveSection} onPublish={vi.fn()} onDownload={onDownload} />);
    fireEvent.change(screen.getByLabelText("Executive decision"), { target: { value: "Launch to the priority segment." } });
    fireEvent.click(screen.getByRole("button", { name: /save executive decision/i }));
    expect(onSaveSection).toHaveBeenCalledWith("executive_decision", "Launch to the priority segment.");
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    fireEvent.click(screen.getByRole("button", { name: /download pptx/i }));
    expect(onDownload).toHaveBeenNthCalledWith(1, "pdf");
    expect(onDownload).toHaveBeenNthCalledWith(2, "pptx");
  });
});
