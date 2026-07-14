"use node";

import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { calculateBillableCredits } from "./lib/billing";
import { createReportDocument } from "../src/features/report/reportDocument";
import { renderReportPdf } from "../src/features/report/renderPdf";
import { renderReportPptx } from "../src/features/report/renderPptx";

export const REPORT_GENERATION_CREDITS = calculateBillableCredits({ operation: "report_generation", nativeQuantity: 1 }).credits;
export const reportReservationKey = (reportVersionId: string) => `report:${reportVersionId}`;
export function reportSettlementInput(args: { organizationId: string; reservationId: string; reportVersionId: string }) {
  return { organizationId: args.organizationId, reservationId: args.reservationId, provider: "meridian-report-renderer", providerOperationId: args.reportVersionId, nativeQuantity: 1, internalCostMicros: 0, model: "structured-document-v1" };
}

export const generateReport = action({
  args: { studyId: v.id("studies") },
  handler: async (ctx, args): Promise<{ reportVersionId: Id<"reportVersions"> }> => {
    const prepared = await ctx.runMutation(internal.reports.beginReport, args);
    let reservationId: Id<"creditReservations"> | undefined;
    try {
      const reservation = await ctx.runMutation(api.credits.reserveCredits, { organizationId: prepared.organizationId, studyId: args.studyId, operationId: prepared.reportVersionId, operation: "report_generation", maximumCredits: REPORT_GENERATION_CREDITS, idempotencyKey: reportReservationKey(prepared.reportVersionId), expiresAt: Date.now() + 30 * 60 * 1000 });
      reservationId = reservation.reservationId;
      await ctx.runMutation(internal.reports.attachReservation, { reportVersionId: prepared.reportVersionId, reservationId });
      const document = createReportDocument({ study: prepared.study, analysis: prepared.analysisSnapshot, brand: prepared.brandSnapshot, generatedAt: prepared.generatedAt });
      const [pdf, pptx] = await Promise.all([renderReportPdf(document), renderReportPptx(document)]);
      const [pdfStorageId, pptxStorageId] = await Promise.all([ctx.storage.store(new Blob([Buffer.from(pdf)], { type: "application/pdf" })), ctx.storage.store(new Blob([Buffer.from(pptx)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }))]);
      const settlement = await ctx.runMutation(internal.credits.reconcileUsage, reportSettlementInput({ organizationId: prepared.organizationId, reservationId, reportVersionId: prepared.reportVersionId }) as Parameters<typeof ctx.runMutation>[1]);
      if (settlement.finalDebit === undefined) throw new Error("Report credit settlement did not return a final debit");
      await ctx.runMutation(internal.reports.completeReport, { reportVersionId: prepared.reportVersionId, document, pdfStorageId, pptxStorageId, finalizedCredits: settlement.finalDebit });
      return { reportVersionId: prepared.reportVersionId };
    } catch (error) {
      if (reservationId) await ctx.runMutation(internal.credits.releaseReservation, { organizationId: prepared.organizationId, reservationId, idempotencyKey: `report-failed:${prepared.reportVersionId}`, reason: "report_failed" }).catch(() => undefined);
      await ctx.runMutation(internal.reports.failReport, { reportVersionId: prepared.reportVersionId, error: error instanceof Error ? error.message : "Report generation failed" });
      throw error;
    }
  },
});

export const regenerateReportExports = action({
  args: { reportVersionId: v.id("reportVersions") },
  handler: async (ctx, args): Promise<void> => {
    const report = await ctx.runQuery(api.reports.getReport, args);
    if (!report) throw new Error("Report not found");
    if (report.status === "published") throw new Error("A published report cannot be changed");
    const [pdf, pptx] = await Promise.all([renderReportPdf(report.document), renderReportPptx(report.document)]);
    const [pdfStorageId, pptxStorageId] = await Promise.all([
      ctx.storage.store(new Blob([Buffer.from(pdf)], { type: "application/pdf" })),
      ctx.storage.store(new Blob([Buffer.from(pptx)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })),
    ]);
    await ctx.runMutation(internal.reports.replaceExports, { reportVersionId: args.reportVersionId, pdfStorageId, pptxStorageId });
  },
});
