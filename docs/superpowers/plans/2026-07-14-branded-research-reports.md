# Branded Research Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build structured, evidence-linked research reports that snapshot analysis and brand state, support editing, and export matching PDF and PPTX artifacts with safe workspace downloads and exact billing reconciliation.

**Architecture:** A renderer-neutral report document is the source of truth for the editor and both exporters. Convex stores immutable generation snapshots, editable sections, exact internal usage components, one customer-facing credit settlement, and storage IDs; every public operation derives the workspace from an authenticated study/report lookup.

**Tech Stack:** TypeScript, React 19, Convex 1.42, Vitest/Node test runner, pdf-lib, pptxgenjs, Poppler, LibreOffice.

## Global Constraints

- Define exactly these section kinds: cover, executive decision, key findings, segment differences, counter-evidence, recommendations, methodology/sample, limitations, and appendix.
- Every report claim must reference at least one finding from the snapshotted analysis.
- PDF and PPTX must consume the same normalized report document.
- Tests must not call live AI, image, or export providers.
- Reserve generation credits before work, preserve exact internal component usage, and finalize one understandable `report_generation` customer charge.
- Convex storage URLs must only be requested after authenticated workspace access succeeds.
- The fixture report must be rendered and every page/slide inspected for clipping, overflow, missing fonts, incorrect colors, and broken evidence labels.

---

### Task 1: Report document contract and validation

**Files:**
- Create: `src/features/report/reportDocument.ts`
- Create: `tests/fixtures/report-study.json`
- Test: `src/features/report/reportDocument.test.ts`

**Interfaces:**
- Consumes: analysis finding snapshots and brand profile snapshots.
- Produces: `ReportDocument`, `ReportSection`, `ReportClaim`, `createReportDocument`, `validateReportDocument`, and `REPORT_SECTION_KINDS`.

- [ ] Write tests that require all nine ordered section kinds, immutable analysis/brand snapshots, and finding-backed claims.
- [ ] Run `pnpm exec vitest run src/features/report/reportDocument.test.ts` and confirm failure because the module is missing.
- [ ] Implement the minimal types, generator, and validator.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Shared layout and deterministic exporters

**Files:**
- Create: `src/features/report/reportLayout.ts`
- Create: `src/features/report/renderPdf.ts`
- Create: `src/features/report/renderPptx.ts`
- Create: `src/features/report/reportExports.test.ts`
- Create: `scripts/render-report.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: validated `ReportDocument`.
- Produces: `planReportPages`, `renderReportPdf`, `renderReportPptx`, `assertLayoutFits`, and a fixture rendering CLI.

- [ ] Write tests asserting both exporters accept the same fixture document, produce valid file signatures, retain evidence labels, and keep every planned text box inside page/slide bounds.
- [ ] Run the focused export test and confirm failure because renderer modules are missing.
- [ ] Add pdf-lib and pptxgenjs and implement shared wrapping/pagination plus both exporters.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Report state, authorization, and billing orchestration

**Files:**
- Create: `convex/reports.ts`
- Create: `convex/reportActions.ts`
- Create: `tests/reportsBackend.test.ts`
- Create: `tests/reportActions.test.ts`
- Modify: `convex/schema.ts`

**Interfaces:**
- Consumes: study access, completed analysis/finding records, brand profiles, credit reservations, renderer byte arrays, and Convex storage.
- Produces: `generateReport`, `updateReportSection`, `publishReport`, `getReportDownloadUrl`, report queries, and internal generation/export mutations.

- [ ] Write backend tests for snapshot persistence, section update validation, published immutability, membership-gated downloads, exact usage itemization, and one charge summary.
- [ ] Run focused backend tests and confirm expected missing-module failures.
- [ ] Implement public/internal Convex functions and a dependency-injected generation/publish service whose tests use deterministic local providers.
- [ ] Re-run focused backend tests and confirm they pass.

### Task 4: Evidence-first report editor

**Files:**
- Create: `src/features/report/ReportEditor.tsx`
- Create: `src/features/report/ReportEditor.test.tsx`
- Create: `src/features/report/index.ts`

**Interfaces:**
- Consumes: `ReportDocument`, save/publish/download callbacks, and generation state.
- Produces: accessible section navigation, inline editing, generation progress, evidence links, and branded proof preview.

- [ ] Write interaction tests for section navigation, inline save, evidence labels, brand preview, progress, publish, and downloads.
- [ ] Run the focused component test and confirm failure because the editor is missing.
- [ ] Implement the editor with existing Meridian primitives and workspace tokens.
- [ ] Re-run the component test and confirm it passes.

### Task 5: Artifact QA and final verification

**Files:**
- Create: `output/pdf/fixture-research-report.pdf`
- Create: `output/pptx/fixture-research-report.pptx`
- Create: task report in the parent integration worktree.

**Interfaces:**
- Consumes: fixture report and renderer CLI.
- Produces: inspected PDF/PPTX artifacts, test evidence, commit SHA, assumptions, and integration risks.

- [ ] Run the fixture renderer and validate page count/file structure.
- [ ] Render PDF pages with Poppler and PPTX slides with LibreOffice; run slide overflow detection and inspect every full-size image.
- [ ] Run focused tests, full build, lint on changed files, and `git diff --check`.
- [ ] Write the task report, commit all verified changes with `feat: export branded research reports`, and record the SHA.
