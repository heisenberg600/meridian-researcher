# Meridian End-to-End Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate Meridian's complete governed study workflow from context ingestion through branded report downloads.

**Architecture:** Preserve existing Convex domain modules and Vite/React shell. Add focused provider/job adapters and mount feature modules through the active Portal route path.

**Tech Stack:** React 19, Vite 8, TypeScript, Convex, AI SDK/OpenAI, Resend, ElevenLabs, Vitest, Node test runner, Playwright.

## Global Constraints

- Keep secrets server-side and commit no environment values.
- Preserve the approved workflow and prepaid-credit invariants.
- Keep Cloudflare project `hermes-researcher` until a replacement exists.
- Use test-first changes and avoid unrelated UI redesign.

---

### Task 1: Unified provider and knowledge processing runtime

**Files:** Create `convex/lib/ai.ts`, provider contract tests; modify `convex/meridian.ts`, `convex/interviewBriefs.ts`, `convex/interviews.ts`, `convex/analysisActions.ts`, `convex/knowledge.ts`, `convex/knowledgeActions.ts`, `.env.example`.

**Interfaces:** Produces `getOpenAIModel(purpose)`, usage normalization, credit-safe provider execution, and queued knowledge processing actions callable from `knowledge.submitLink`, `knowledge.submitUpload`, and `knowledge.retry`.

- [ ] Write failing tests proving active paths use `OPENAI_API_KEY`, never expose it, normalize exact usage, release failed reservations, and schedule queued sources.
- [ ] Run focused tests and confirm the intended failures.
- [ ] Implement the minimal shared runtime and processing lifecycle with memory refresh scheduling.
- [ ] Run focused tests, TypeScript, and lint; commit `feat: unify AI and knowledge processing`.

### Task 2: Governed outreach execution and fieldwork

**Files:** Modify `convex/outreachBatches.ts`, `convex/participantInvites.ts`, `convex/callRecords.ts`, `convex/interviews.ts`, `convex/studyParticipants.ts`; add focused tests.

**Interfaces:** Produces `launchApprovedBatch`, `retryDelivery`, provider-safe execution records, and final participant/delivery status queries consumed by `FieldworkPage`.

- [ ] Write failing tests proving direct provider bypass is impossible and last-mile gates/idempotency/settlement run.
- [ ] Run focused tests and confirm failures.
- [ ] Route provider actions through approved deliveries; finalize email/voice credits and lifecycle state.
- [ ] Run focused tests, TypeScript, and lint; commit `fix: complete governed outreach execution`.

### Task 3: Analysis/report persistence and authorized exports

**Files:** Modify `convex/evidence.ts`, `convex/findings.ts`, `convex/analysisActions.ts`, `convex/schema.ts`; create `convex/reports.ts`, `convex/reportActions.ts`, report adapters/tests.

**Interfaces:** Produces `getAnalysis`, `listFindings`, `getEvidenceDetail`, `generateReport`, `updateReportSection`, `publishReport`, and `getReportDownloadUrl`.

- [ ] Write failing tests for organization access, immutable snapshots, evidence-linked claims, storage IDs, signed URLs, and report credit settlement.
- [ ] Run focused tests and confirm failures.
- [ ] Implement report persistence/actions using the shared structured document and PDF/PPTX renderers.
- [ ] Run focused tests, render fixture exports, TypeScript, and lint; commit `feat: persist analysis and branded reports`.

### Task 4: Mount the complete study workflow

**Files:** Modify `src/Portal.tsx`, `src/app/routes.ts`; create focused adapters under `src/features/study-workflow/`; modify active feature pages only as needed.

**Interfaces:** Consumes Tasks 1-3 APIs and mounts Study Memory, Fieldwork, Analysis, and Report without bypassing plan/questionnaire/import approvals.

- [ ] Write failing route/component tests for all active study destinations and actionable empty/error states.
- [ ] Run focused tests and confirm failures.
- [ ] Add adapters and mount each feature page; preserve plan approval and participant import.
- [ ] Run focused tests and commit `feat: activate the complete study workflow`.

### Task 5: Integration and deployment gate

**Files:** Modify generated Convex bindings, `README.md`, and E2E tests only when required.

**Interfaces:** Produces a branch ready for review and Cloudflare deployment through the existing workflow.

- [ ] Run configured `pnpm convex:codegen` and fix only integration contract failures.
- [ ] Run `pnpm test`, `pnpm build`, and `pnpm lint`.
- [ ] Run configured desktop/mobile Playwright flow through plan, questionnaire, participant review, fieldwork, analysis, and report.
- [ ] Record any environment-blocked provider smoke checks by variable name only.
- [ ] Commit `chore: verify Meridian end-to-end wiring`, push the branch, and open a draft PR.
