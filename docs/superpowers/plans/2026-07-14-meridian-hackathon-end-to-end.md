# Meridian Hackathon End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Meridian prototype into a coherent credit-funded B2B research workflow that moves from company context and study design through participant import, approved outreach, AI interviews, analysis, and branded PDF/PPTX delivery.

**Architecture:** Keep the application as a Convex modular monolith with a Vite/React frontend. Establish the schema, workflow state machine, and route/component boundaries first; then let feature agents work in isolated files against those contracts. Use background agents for extraction, memory maintenance, interviewing, analysis, and report drafting, while requiring a human approval only for study design, participant/outreach launch, and final report publication.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind CSS 4, Convex, Clerk, AI SDK with the official OpenAI provider, ElevenLabs, Resend, LinkUp, Vitest, Testing Library, and Playwright.

## Global Constraints

- This is a hackathon build; optimize for a complete, convincing vertical slice rather than production-scale infrastructure.
- One organization workspace may have multiple users, but v1 has no customer-facing roles or permission matrix.
- Knowledge sources in v1 are website crawling, PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX/CSV, uploaded audio/video, and public media links.
- Google Drive, Notion, Slack, CRM, and data-warehouse connectors are out of scope.
- Participant data may only come from the uploaded file, user edits, company memory, and project memory. No external participant enrichment.
- The import agent may infer column mappings and normalize values, but uncertain values remain visibly unresolved and are never invented.
- Imported participants must pass review before any external outreach.
- Memory is continuously updated in the background, visible, and directly editable. Do not add approval, citation, confidence, locking, or conflict-resolution workflows to memory.
- Company memory is global; project memory is isolated to its study; branding is a separate editable profile.
- Final output must support customer-branded PDF and PPTX exports.
- Cloudflare Pages remains the frontend host and Convex remains the backend.
- The canonical design reference is `/Users/saurabh/Downloads/# Console Feature Pages (2).zip`, SHA-256 `3ff66846abe35408bdd74028fb6020a2577549e4d80aaac22d1deab106541e5f`.
- Use the OpenAI Image API with `gpt-image-2` as the primary generator for the product asset family. Higgsfield may provide optional comparison concepts if its MCP becomes available, but it is no longer a blocker.
- Store `OPENAI_API_KEY` only as a Convex/server-side secret. Never prefix it with `VITE_`, serialize it into agent output, or expose it to the browser.
- The same `OPENAI_API_KEY` is approved for local design-asset generation through the bundled image-generation CLI; load it at runtime without printing it and never copy it into the repository.
- An OpenAI key authorizes OpenAI API calls only; it does not create or replace Clerk, Convex, Cloudflare, Resend, ElevenLabs, LinkUp, or Higgsfield credentials.
- Billing is a hackathon POC: organization-level prepaid Dodo top-ups, a large customer-friendly Meridian credit balance, a hard stop at zero, and no subscriptions, overage, negative balance, proration, or automated refunds.
- Exact provider units and estimated provider cost remain in the internal usage ledger. Customer credits use a generous versioned Meridian rate card and are not a dollar-for-dollar pass-through of provider cost.
- Never expose secrets in commits, logs, generated reports, or client-side environment variables.

---

## 1. Current-state review

### What already works and should be retained

| Capability | Current implementation | Decision |
|---|---|---|
| Authentication | Clerk gate and Convex user bootstrap | Keep; simplify customer access to equal workspace access |
| Organization foundation | Organizations and memberships exist | Keep data ownership; do not build roles UI |
| Study creation | Study, initial chat session, and strategist run are created | Keep and surface in new Studies UI |
| Agent chat | Persisted streaming messages, runs, tool events, LinkUp search, and sandbox | Keep; replace the hard-coded Gemini/Vercel Gateway default with one server-side OpenAI adapter and split runtime into focused modules |
| Study plans | Versioned plan drafts and awaiting-approval state | Keep and add the missing approval mutation/invariant |
| Interview guides | Generated, versioned, and approvable | Keep; prevent generation from unapproved plans and invalidate stale guides |
| Participants | Manual CRUD and basic duplicate checks | Keep as fallback; add spreadsheet-first import |
| Outreach | Resend email and ElevenLabs outbound call actions | Keep providers; place them behind an approved outreach batch |
| Participant experience | Token route, typed interview, browser voice configuration | Keep and restyle from `Canvas.dc.html`; complete persistence and consent |
| Call processing | Polling, transcript, summary, quality scoring, aggregate analytics | Keep; attach evidence records and robust status transitions |
| Usage and checkout foundation | `usageLedger` records AI tokens and Dodo checkout has been tested in Test Mode | Keep; extend into a prepaid organization wallet with idempotent grants, reservations, and debits |
| Internal diagnostics | Laminar traces, usage ledger, tool events, audit events, eval scripts | Keep internally; remove from customer navigation |
| Design language | Ivory, ink, terracotta, Source Serif/Instrument Sans/IBM Plex Mono | Keep and implement as first-class app tokens/components |

### What is currently present but should not appear in the hackathon customer product

1. Internal Management, agent enable/disable, tool assignment, model picker, and provider-control screens.
2. Customer-facing Observability and Evals pages.
3. Multi-role Owner/Researcher/Reviewer/Viewer workflows and permission settings.
4. Appointments calendar, full scheduling operations, complex retry windows, and quota management.
5. CRM, Google Drive, Notion, Slack, and data-warehouse connector UI.
6. External participant enrichment.
7. Memory approval, provenance, citations, confidence scores, locking, and conflict resolution.
8. Separate microservices, queues, or a production event bus.
9. Advanced live-call takeover and provider cost controls; show status/transcript/recording when available, but do not make these demo-critical.
10. Subscription management, usage overage, proration, saved-payment-method management, and production refund automation.

The Dodo and usage-ledger foundations now become part of the customer POC. Laminar traces and eval tooling remain internal and unlinked.

### What must be replaced or corrected

- Replace the 2,365-line `src/Portal.tsx` monolith with route shells and feature modules.
- Replace implicit pathname parsing scattered through the portal with a single route registry.
- Stop importing production styles from a UUID-named design-export directory.
- Enforce plan approval before questionnaire/brief generation.
- Enforce approved questionnaire and participant batch before outreach.
- Prevent an approved guide from remaining current when its parent plan changes.
- Add spreadsheet parsing, mapping, invalid-row review, duplicate detection, suppression checks, segment assignment, and batch approval.
- Add knowledge ingestion and background company/project memory updates.
- Add structured response/evidence records, findings, report generation, and PDF/PPTX exports.
- Finish participant consent, interview completion, and participant/study status transitions.
- Add loading, empty, error, retry, destructive-confirmation, responsive, keyboard, and accessible-control states.
- Change the Cloudflare project/repository references from the old Hermes name when deployment work begins.
- Add a prepaid wallet, Dodo top-up checkout, verified payment webhook, atomic credit reservations, usage finalization, and customer billing page.

---

## 2. Target product

### Customer workspace navigation

1. **Studies** — list, create, status, recent activity, and continue work.
2. **Company knowledge** — website scan, uploaded sources, processing status, and source removal.
3. **Company memory** — a plain editable list automatically maintained from company knowledge and workspace conversations.
4. **Brand** — name, logo, colors, report title/footer, tone, and optional font preferences with live report preview.
5. **Activity** — concise workspace/study audit feed; no agent-debug telemetry.
6. **Billing** — large remaining credit balance, top-up packs, low-balance warning, and usage grouped by study and operation.

### Study navigation

1. **Overview / Chat** — decision, current phase, next action, agent conversation, and agent activity timeline.
2. **Plan** — versioned research plan with approve/revise action.
3. **Questionnaire** — interview brief/questionnaire editor, quality warnings, test interaction, and approval.
4. **Participants** — spreadsheet-first import, manual add, review table, segments, validation, and batch approval.
5. **Fieldwork** — email/voice launch confirmation, participant statuses, call/email response details, transcripts, and retry action.
6. **Analysis** — themes, question/segment views, evidence-backed findings, contradictions, and follow-up chat.
7. **Report** — editable branded report, evidence drill-down, generation status, PDF export, and PPTX export.
8. **Memory** — editable study-specific memory maintained from study conversations and artifacts.

### Respondent experience

- Branded invitation page with clear AI/recording disclosure and consent.
- Choose phone interview or typed interview when the participant has both options.
- Voice call or browser voice mode when configured.
- One-question-at-a-time accessible typed flow.
- Resume-safe progress, completion state, and withdrawal handling.

### Signature interaction

The differentiating interface is a visible evidence chain:

```text
Company/study context → approved plan → approved questionnaire → response excerpt
→ coded evidence → finding → report recommendation
```

Analysis and report screens must let a user open the participant response behind a finding. The hackathon version can use transcript timestamps and answer identifiers; it does not need a full citation-management system for memory.

---

## 3. Backend design

### Convex domain modules

Create these focused backend modules instead of adding more unrelated logic to `convex/meridian.ts`:

| Module | Responsibility |
|---|---|
| `convex/lib/auth.ts` | Current user, organization, and study-access helpers |
| `convex/lib/workflow.ts` | Study phase guards and valid state transitions |
| `convex/lib/ai.ts` | Official OpenAI provider factory, model-purpose routing, structured generation, usage recording |
| `convex/lib/billing.ts` | Versioned customer rate card, internal usage measurement, and billable-credit calculation |
| `convex/credits.ts` | Wallet queries, reservations, final debits, releases, grants, and usage history |
| `convex/payments.ts` | Dodo checkout sessions and organization/customer mapping |
| `convex/paymentWebhooks.ts` | Raw webhook verification, idempotent payment processing, and reconciliation |
| `convex/knowledge.ts` | Source metadata, upload URLs, website/media submissions, processing state |
| `convex/knowledgeActions.ts` | Website/file extraction, chunking, summaries, and memory refresh scheduling |
| `convex/companyMemory.ts` | Global memory list/edit/delete and agent upsert |
| `convex/studyMemory.ts` | Study memory list/edit/delete and agent upsert |
| `convex/brandProfiles.ts` | Organization branding and report preferences |
| `convex/participantImports.ts` | Upload batch, mappings, row validation, review edits, and approval |
| `convex/outreachBatches.ts` | Approval snapshot, launch, per-participant delivery state, retries |
| `convex/evidence.ts` | Normalized answers, transcript spans, codes, and evidence lookup |
| `convex/findings.ts` | Analysis runs, themes, findings, counter-evidence, and segment summaries |
| `convex/reports.ts` | Report draft/version/status/edit/publish metadata |
| `convex/reportActions.ts` | Report generation and storage of PDF/PPTX files |

### Schema additions and simplifications

`convex/schema.ts` remains owned by the lead agent to avoid merge conflicts. Add:

- `knowledgeSources`: organization, optional study, kind, storage/link metadata, status, extracted text summary, error, timestamps.
- `studyMemories`: study, key, value, category, active state, timestamps.
- `brandProfiles`: organization, logo storage ID, primary/accent colors, display name, tone, report footer, updated timestamp.
- `participantImportBatches`: study, filename, storage ID, mapping, counts, status, approved timestamp/user.
- `participantImportRows`: batch, row number, raw data, normalized participant fields, issues, duplicate/suppression flags, disposition.
- `suppressionEntries`: organization, normalized email/phone, reason, timestamp.
- `outreachBatches`: study, questionnaire version, participant IDs, channels, status, approval and launch timestamps.
- `responseEvidence`: study, participant, channel, source record, question/topic, excerpt, timestamp/answer locator, segment metadata.
- `analysisRuns`: study, input snapshot, status, summary, timestamps, error.
- `findings`: analysis run, title, narrative, type, strength label, supporting/conflicting evidence IDs, segment.
- `reportVersions`: study, analysis run, brand snapshot, structured sections, status, PDF/PPTX storage IDs, timestamps.
- `billingAccounts`: organization, Dodo customer ID, mode, status, timestamps.
- `creditWallets`: organization, granted, available, reserved, consumed, updated timestamp.
- `creditTransactions`: organization, optional study/operation references, grant/reserve/debit/release/refund/adjustment type, amount, balance-after, idempotency key, rate-card version, timestamps.
- `creditReservations`: organization, operation ID/type, maximum credit amount, status, expiry, final debit, timestamps.
- `checkoutSessions`: organization, Dodo session/payment IDs, pack key, expected grant, status, timestamps.
- `paymentWebhookEvents`: Dodo event ID/type, payload hash, processing status/error, timestamp.
- `rateCards`: version, operation, native unit, generous customer-credit multiplier, active timestamp.

Simplify `organizationMemories` for future writes by making confidence, importance, source, and run provenance optional. Do not spend hackathon time migrating or displaying those legacy fields.

Extend `usageLedger` with provider, provider operation ID, native quantity/unit, internal cost in integer USD micros, billed credits, credit transaction ID, rate-card version, and finalized status. Exact provider usage remains internal; the customer UI shows understandable operation labels and charged credits.

### POC credit model

- Create one organization wallet and grant a large free starter balance on workspace creation.
- Offer a small set of one-time Dodo top-up packs. Each dollar grants a deliberately large-looking quantity of Meridian credits; this scale is product configuration, not provider-cost pass-through.
- Use whole-number displayed credits and integer arithmetic throughout.
- Keep customer rates simple and generous: AI chat and email are cheap, source ingestion and report generation are moderate, and connected voice minutes are the largest charge.
- Store the exact native measurement for every operation even when the customer charge is simplified.
- Before a provider call, atomically reserve a conservative maximum. After completion, debit actual rate-card credits and release the unused reservation.
- On a pre-provider failure, release the full reservation. On partial provider usage, charge only the measured portion.
- Grant purchased credits only from a signature-verified, idempotently processed Dodo webhook; never trust the browser return URL.
- Block new billable work at zero balance and show the top-up action. Do not interrupt already-running respondent calls for a low balance.
- Version the rate card so future pricing changes do not rewrite historical usage.

### Study workflow state machine

Use one guard function for all mutations/actions:

```text
draft
  → awaiting_plan_approval
  → plan_approved
  → questionnaire_approved
  → participants_under_review
  → fieldwork_ready
  → fieldwork_running
  → analyzing
  → report_ready
  → completed
```

Required invariants:

- Only an approved plan version can generate a questionnaire.
- Saving a new plan version supersedes its questionnaire and blocks outreach.
- Outreach snapshots one approved questionnaire version and one approved participant batch.
- Provider calls never run directly from a participant-row button before approval.
- Consent is captured before interview answers or recording are accepted.
- Every response records the questionnaire version used.
- Analysis snapshots the response/evidence IDs it analyzed.
- Report generation snapshots the analysis run and brand profile used.

### Agent responsibilities

Use one orchestrator contract and specialized jobs, not free-running autonomous sub-agents:

1. **Workspace context agent** — processes knowledge sources and refreshes company memory.
2. **Study strategist** — uses company memory, project memory, and study chat to draft/revise the plan.
3. **Questionnaire agent** — generates and checks the questionnaire from the approved plan only.
4. **Import assistant** — infers spreadsheet mappings and normalization without external lookup.
5. **Interviewer** — follows the approved questionnaire and records structured coverage/evidence.
6. **Analyst** — produces findings with supporting and conflicting evidence IDs.
7. **Report writer** — turns the approved analysis snapshot into editable branded sections and exports.
8. **Memory refresher** — updates simple global or study memories after relevant ingestion/chat/artifact events.

The UI may present these as a team timeline, but backend work remains explicit Convex actions with statuses, inputs, outputs, retry behavior, and audit events.

---

## 4. Frontend design and file map

### Foundation

- `src/app/PortalApp.tsx` — authenticated route composition.
- `src/app/route.ts` — route parser, path builders, and route tests.
- `src/app/WorkspaceShell.tsx` — global navigation and responsive shell.
- `src/app/StudyShell.tsx` — study navigation, lifecycle badge, and next-action header.
- `src/styles/tokens.css` — stable Meridian design tokens copied semantically from the canonical design.
- `src/styles/base.css` — global type, focus, and surface rules.
- `src/components/meridian/*` — Button, IconButton, Badge, Card, Tabs, EmptyState, ErrorState, Dialog, Toast, AgentTimeline, ApprovalCard, SheetGrid, SourceRow, MemoryEditor, EvidenceLink.

### Workspace features

- `src/features/studies/StudiesPage.tsx`
- `src/features/studies/CreateStudyDialog.tsx`
- `src/features/knowledge/KnowledgePage.tsx`
- `src/features/knowledge/SourceUploader.tsx`
- `src/features/memory/CompanyMemoryPage.tsx`
- `src/features/brand/BrandPage.tsx`
- `src/features/brand/ReportPreview.tsx`
- `src/features/activity/ActivityPage.tsx`
- `src/features/billing/BillingPage.tsx`
- `src/features/billing/CreditBalance.tsx`
- `src/features/billing/CreditPacks.tsx`
- `src/features/billing/UsageHistory.tsx`

### Study features

- `src/features/study-overview/StudyOverviewPage.tsx`
- `src/features/chat/StudyChat.tsx`
- `src/features/plan/PlanPage.tsx`
- `src/features/questionnaire/QuestionnairePage.tsx`
- `src/features/participants/ParticipantsPage.tsx`
- `src/features/participants/ImportWizard.tsx`
- `src/features/participants/MappingStep.tsx`
- `src/features/participants/RowReviewStep.tsx`
- `src/features/fieldwork/FieldworkPage.tsx`
- `src/features/fieldwork/ResponseDetail.tsx`
- `src/features/analysis/AnalysisPage.tsx`
- `src/features/analysis/FindingPanel.tsx`
- `src/features/report/ReportPage.tsx`
- `src/features/report/ReportEditor.tsx`
- `src/features/memory/StudyMemoryPage.tsx`

### Respondent features

- Refactor `src/InterviewPrototype.tsx` into `src/features/respondent/RespondentApp.tsx`.
- Add `ConsentStep.tsx`, `ModeChoiceStep.tsx`, `TypedInterview.tsx`, `VoiceInterview.tsx`, and `CompletionStep.tsx`.

### Design reference import

Copy the four missing canonical reference artifacts into `docs/ui-estimates/console-feature-pages/` without executing them:

- `.thumbnail`
- `Canvas.dc.html`
- `Meridian Console.dc.html`
- `uploads/pasted-1784010293158-0.png`

The HTML export is a visual reference, not production code. Rebuild it as typed, accessible React components. Correct its unreachable Email panel, fixed canvas sizing, toast-only actions, invalid CSS, and inaccessible clickable `<div>` elements.

### Visual asset direction and placement

Keep the existing landing-page art direction and its current asset placements:

- `/public/landing/hero-waitlist-v2.webp` remains the landing hero.
- `/public/landing/paper-texture.webp` remains the page texture.
- `/public/landing/cta-dark.jpg` remains the closing CTA background.
- `/public/landing/auth-panel.jpg` remains the signed-out portal panel.

Do not turn the application into a gallery of decorative AI images. Product assets must reinforce the research workflow and preserve information density. The common visual grammar is warm editorial paper, field-note fragments, abstract evidence layers, restrained topographic lines, audio waveforms, and report-cover compositions. Avoid generic people-at-laptop scenes, floating 3D blobs, fake UI screenshots, humanoid robots, and photographic participant faces.

Generate and place this controlled set through the OpenAI Image API using `gpt-image-2`:

| Asset | File target | Placement | Treatment |
|---|---|---|---|
| Workspace research field | `public/product-assets/workspace-field.webp` | Studies empty state and create-study welcome panel | 4:3 editorial still life, low contrast, right-aligned crop |
| Knowledge source collage | `public/product-assets/knowledge-collage.webp` | Knowledge page introduction/empty state | 3:2 layered documents, audio waveform, spreadsheet grid, no readable fake text |
| Study contour band | `public/product-assets/study-contours.webp` | Overview header and phase transition panels | 3:1 abstract contour/evidence paths, transparent-feeling ivory ground |
| Participant import sheet | `public/product-assets/import-sheet.webp` | Import wizard upload step only | 4:3 editorial spreadsheet/paper composition; table itself remains real UI |
| Fieldwork signal | `public/product-assets/fieldwork-signal.webp` | Fieldwork empty/launch state | 3:2 restrained waveform/telephone-line abstraction, no literal stock call-center image |
| Analysis evidence map | `public/product-assets/evidence-map.webp` | Analysis empty/generating state | 16:9 clustered notes connected to evidence markers |
| Default report cover | `public/product-assets/report-cover-default.webp` | Report preview when customer has no cover art | A4/slide-safe abstract research atlas; brand color applied as CSS overlay |
| Respondent background | `public/product-assets/respondent-contours.webp` | Respondent introduction and completion only | 9:16/16:9 crop-safe subtle contours, deliberately quiet behind form controls |

Rules for asset use:

- Every asset has desktop and mobile-safe focal points; use CSS `object-position` rather than separate arbitrary crops unless composition fails.
- Decorative assets use empty alt text; informative brand/user uploads receive user-provided or generated descriptive alt text.
- Never place generated imagery behind dense tables, transcripts, questionnaire fields, or report body copy.
- Use assets for empty, onboarding, progress, and completion states; use data visualization and actual evidence for populated states.
- Optimize generated originals to WebP/AVIF, cap ordinary UI assets at 2400 px on the long edge, and keep each delivered file below 450 KB where visual quality permits.
- Store prompts, output dimensions, crop guidance, and placements in `public/product-assets/manifest.json` so a future agent can regenerate consistently.
- Customer logos, colors, and uploaded report imagery always override Meridian defaults; never regenerate or reinterpret a customer logo.
- The report cover uses the brand profile plus the default cover composition. It must work in both A4 portrait PDF and 16:9 PPTX crops.

Before generation, the visual-design agent produces a contact sheet with two coherent directions for this eight-asset family. The user selects one family; the agent then generates final assets and validates every in-product crop. Do not mix unrelated styles across pages.

OpenAI generation workflow:

1. Use the Image API for discrete asset generation and edits; use the bundled CLI at `/Users/saurabh/.codex/skills/imagegen/scripts/image_gen.py` with an explicit `--model gpt-image-2`.
2. Generate two art-direction boards at `quality=low` for fast review.
3. Carry the selected board into every asset prompt as a style reference, using the edits endpoint where visual continuity needs reinforcement.
4. Generate final UI assets at `quality=medium`; reserve `quality=high` for the report cover or any detail-critical asset that visibly benefits from it.
5. Use exact intended output ratios and dimensions. GPT Image 2 accepts flexible sizes when both edges are multiples of 16, neither edge exceeds 3840 px, and the aspect ratio is no wider than 3:1.
6. Keep typography and interface controls out of generated images. Render all meaningful text, charts, tables, and controls as HTML/CSS or report-native elements.
7. Iterate with one change per edit: composition, palette, texture, or focal point. Repeat the elements that must remain unchanged.
8. Save masters under `output/imagegen/`, optimize approved derivatives into `public/product-assets/`, and record model, prompt, dimensions, quality, crop focus, and final placement in `manifest.json`.

Current official references:

- [GPT Image 2 model](https://developers.openai.com/api/docs/models/gpt-image-2)
- [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
- [GPT Image prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)

---

## 5. Execution tasks

### Task 1: Baseline, tests, and canonical design reference

**Owner:** Lead agent

**Files:**
- Modify: `package.json`, `vite.config.ts`, `eslint.config.mjs`
- Create: `vitest.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `tests/e2e/smoke.spec.ts`
- Add canonical design files under `docs/ui-estimates/console-feature-pages/`

**Produces:** `pnpm test`, `pnpm test:e2e`, and a stable design reference.

- [ ] Add Vitest, jsdom, Testing Library, user-event, and Playwright development dependencies.
- [ ] Add scripts `test`, `test:watch`, and `test:e2e`.
- [ ] Add a smoke test asserting landing, signed-out portal, and invalid participant invite routes render without uncaught errors.
- [ ] Run `pnpm lint`; expected exit code 0.
- [ ] Run `pnpm build`; expected exit code 0.
- [ ] Run `pnpm test --run`; expected all tests pass.
- [ ] Commit as `test: establish Meridian frontend verification baseline`.

### Task 2: Shared schema, authorization, and workflow contracts

**Owner:** Lead agent; blocks all backend feature agents.

**Files:**
- Modify: `convex/schema.ts`, `convex/studies.ts`, `convex/studyPlans.ts`, `convex/interviewBriefs.ts`
- Create: `convex/lib/auth.ts`, `convex/lib/workflow.ts`, `convex/workflowTests.ts`

**Produces:** `requireOrganizationAccess`, `requireStudyAccess`, `assertStudyCan`, `transitionStudy`, and the new tables listed in Section 3.

- [ ] Write Convex tests for unauthorized cross-organization reads, invalid transitions, plan approval, stale questionnaire invalidation, and outreach preconditions.
- [ ] Run the workflow tests and confirm they fail against current behavior.
- [ ] Centralize access helpers and replace duplicated study access checks in touched modules.
- [ ] Add `studyPlans.approve` and update the study status/current version atomically.
- [ ] Require the approved current plan in `interviewBriefs.generateFromPlan`.
- [ ] Supersede the current questionnaire when a new plan becomes current.
- [ ] Run `pnpm convex:codegen`, `pnpm test --run`, and `pnpm build`; all must pass.
- [ ] Commit as `feat: enforce the Meridian study workflow`.

### Task 2A: POC prepaid credits and Dodo control plane

**Owner:** Billing backend agent; begins after Task 2 establishes the shared schema.

**Files:**
- Create: `convex/lib/billing.ts`, `convex/credits.ts`, `convex/payments.ts`, `convex/paymentWebhooks.ts`, `convex/http.ts`.
- Modify: `convex/users.ts`, `convex/meridianData.ts`, `.env.example`.
- Test: `convex/billingTests.ts`.

**Produces:** `getWallet`, `reserveCredits`, `finalizeReservation`, `releaseReservation`, `createTopUpCheckout`, and an idempotent verified Dodo webhook handler.

- [ ] Write failing tests for starter grants, insufficient balance, two concurrent reservations, final debit/release, duplicate payment webhooks, wrong-organization access, and rate-card version preservation.
- [ ] Create an organization wallet with a large starter grant exactly once when the workspace is provisioned.
- [ ] Implement a generous whole-number rate card for AI, source processing, email, connected voice time, analysis, reports, and image generation; keep exact provider units separate.
- [ ] Implement atomic reservations with expiry, finalization, release, and idempotency keys.
- [ ] Create Dodo Test Mode checkout sessions with organization, pack, and checkout-intent metadata.
- [ ] Verify webhook signatures against the raw request body and grant credits only from an accepted payment event.
- [ ] Persist every webhook event before processing so retries cannot duplicate a grant.
- [ ] Extend `usageLedger` writes with native usage, internal cost micros, customer credits, rate-card version, provider operation ID, and credit transaction ID.
- [ ] Run billing tests, `pnpm convex:codegen`, `pnpm build`, and `pnpm lint`.
- [ ] Commit as `feat: add prepaid Meridian credits`.

### Task 3: New application shell and Meridian design system

**Owner:** UI foundation agent

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`, `src/index.css`
- Create the foundation files in Section 4 and their colocated `*.test.tsx` files.
- Reduce `src/Portal.tsx` to a temporary compatibility export, then delete it after all routes migrate.

**Produces:** Stable workspace/study shells and route APIs that feature agents consume.

- [ ] Write tests for all workspace and study route parsing/path building.
- [ ] Implement semantic tokens and fonts without importing UUID-named documentation CSS.
- [ ] Implement responsive desktop/tablet/mobile shells, skip links, visible focus, keyboard navigation, labelled icon buttons, and route-level loading/error boundaries.
- [ ] Add route-level page shells for every in-scope workspace/study page, including Billing; do not add Management, Evals, or Observability links.
- [ ] Visually verify at 1440×900, 1024×768, and 390×844.
- [ ] Run `pnpm test --run`, `pnpm lint`, and `pnpm build`.
- [ ] Commit as `feat: introduce the Meridian workspace shell`.

### Task 3A: OpenAI-generated asset family and UI placement

**Owner:** Visual-design agent; runs after the shell layout exists and before final page polish.

**Files:**
- Create: `public/product-assets/manifest.json` and the eight optimized assets listed in Section 4.
- Create: `src/components/meridian/ProductArtwork.tsx`, `src/components/meridian/ProductArtwork.test.tsx`.
- Modify only the page components that own the listed placements.

**Produces:** One coherent visual family with stable responsive placements and accessible fallbacks.

- [ ] Confirm that `OPENAI_API_KEY` can be loaded into the generation process without printing its value and that the account can call `gpt-image-2`; if organization verification is required, report that exact API error.
- [ ] Run a dry-run with the bundled CLI using `--model gpt-image-2`, the intended size, quality, format, and output path before spending generation credits.
- [ ] Generate two low-quality art-direction contact sheets covering all eight compositions with consistent art direction.
- [ ] Obtain the user's direction selection before producing final-resolution assets.
- [ ] Generate final master assets at medium quality, using the selected direction as a reference and the crop constraints in Section 4; use high quality only after visual review shows a material benefit.
- [ ] Optimize the approved outputs and record prompt, dimensions, focal point, route placement, and decorative/informative role in `manifest.json`.
- [ ] Implement `ProductArtwork` with explicit asset names, responsive `object-position`, loading color, and decorative alt behavior.
- [ ] Place assets only in the defined empty/onboarding/progress/completion surfaces.
- [ ] Capture desktop and mobile screenshots of every placement and reject crops that obscure controls, fight with typography, or dominate real study data.
- [ ] Run `pnpm test --run`, `pnpm lint`, and `pnpm build`.
- [ ] Commit as `feat: add the Meridian OpenAI artwork system`.

### Task 3B: Billing and usage interface

**Owner:** Billing UI agent; begins after Tasks 2A and 3.

**Files:**
- Create: `src/features/billing/BillingPage.tsx`, `CreditBalance.tsx`, `CreditPacks.tsx`, `UsageHistory.tsx`, and colocated tests.
- Modify only the Billing route registration supplied by Task 3.

**Produces:** Customer-visible wallet balance, top-up checkout, low-balance state, and understandable usage history.

- [ ] Test loading, empty, funded, reserved, low, zero, checkout-return, and provider-error states.
- [ ] Show a large whole-number balance and reserved credits without exposing provider pricing or raw prompts.
- [ ] Show top-up packs with relative value and approximate workload language rather than a promise of exact calls or reports.
- [ ] Redirect to the Dodo-hosted checkout returned by the backend action.
- [ ] On return, show payment processing until the verified webhook updates the wallet; never grant from query parameters.
- [ ] Group usage by study and operation, with native usage details available as secondary information.
- [ ] Provide a clear hard-stop/top-up action at zero and a subtle warning before zero.
- [ ] Run component tests, `pnpm build`, and `pnpm lint`.
- [ ] Commit as `feat: add credit balance and usage UI`.

### Task 4: Company knowledge, simple memory, and brand profile

**Owner:** Context agent; can run after Task 2 in parallel with Tasks 5 and 6.

**Files:**
- Create backend modules `convex/knowledge.ts`, `convex/knowledgeActions.ts`, `convex/companyMemory.ts`, `convex/studyMemory.ts`, `convex/brandProfiles.ts`.
- Create the knowledge, memory, and brand frontend files from Section 4.
- Modify: `.env.example`, `convex/meridianData.ts`.

**Produces:** List/create/edit/remove source APIs; simple memory APIs; `getBrandProfile`/`updateBrandProfile`; background memory refresh jobs.

- [ ] Test file/link kind validation, organization/study isolation, status transitions, editable memory CRUD, and brand defaults.
- [ ] Implement Convex upload URL generation and metadata records.
- [ ] Implement website/public-link extraction through the existing search/crawl capability and file-text extraction for supported v1 formats.
- [ ] Store processing statuses `queued`, `processing`, `ready`, and `failed` with a user-readable error.
- [ ] Schedule a company-memory refresh after a global source becomes ready and a study-memory refresh after relevant study chat/artifact events.
- [ ] Reserve and finalize generous source-processing credits while recording exact extracted pages/minutes/bytes internally.
- [ ] Build Knowledge, Company Memory, Study Memory, and Brand pages with genuine loading/empty/error/editing states.
- [ ] Verify a website and one spreadsheet/document source become visible context for a new study chat.
- [ ] Commit as `feat: add company context memory and branding`.

### Task 5: Study overview, chat, plan, and questionnaire lifecycle

**Owner:** Study workflow agent; can run after Task 2.

**Files:**
- Modify: `convex/meridian.ts`, `convex/meridianData.ts`, `convex/messages.ts`, `convex/interviewBriefs.ts`.
- Create: `convex/lib/ai.ts` and study/chat/plan/questionnaire frontend files from Section 4.

**Produces:** A governed strategist-to-questionnaire flow and consistent AI configuration.

- [ ] Test that chat receives company + project memory, plan approval is required, revised plans invalidate questionnaires, and only approved questionnaires unlock participant review.
- [ ] Add the official OpenAI AI SDK provider, read `OPENAI_API_KEY` only inside Convex actions, and move model-purpose routing plus usage recording into `convex/lib/ai.ts`.
- [ ] Remove the active hard-coded Gemini/Vercel AI Gateway defaults from chat, interview, questionnaire, analysis, and report paths; keep one explicit server-side model configuration shared by those jobs.
- [ ] Route each billable OpenAI run through credit reservation/finalization while preserving exact model token usage in `usageLedger`.
- [ ] Keep one visible agent timeline, but map every item to a real run/tool status.
- [ ] Build the Overview/Chat split canvas from the integrated design.
- [ ] Build plan review/approve/revise and questionnaire edit/test/approve screens.
- [ ] Replace toast-only actions with persisted mutations and explicit success/error states.
- [ ] Commit as `feat: complete governed study design`.

### Task 6: Spreadsheet-first participant import and approval

**Owner:** Import agent; can run after Task 2.

**Files:**
- Create: `convex/participantImports.ts`, `convex/participantImportActions.ts`, `src/features/participants/*`.
- Modify: `convex/studyParticipants.ts`, `.env.example` only if a model setting is added.

**Produces:** `createImport`, `inferMapping`, `validateRows`, `updateRow`, `approveImport`, and manual-add fallback.

- [ ] Add fixture workbooks covering XLSX, quoted CSV fields, missing headers, duplicates, invalid email/phone, suppression, and mixed segments.
- [ ] Test deterministic parsing before model-assisted mapping.
- [ ] Implement agent mapping from uploaded columns to `name`, `email`, `phone`, `segment`, `preferredMode`, and notes using only file values plus company/study memory.
- [ ] Mark ambiguous mappings and invalid values; never synthesize missing contact details.
- [ ] Normalize email/phone, detect within-file and existing-study duplicates, and check organization suppression entries.
- [ ] Build the four-step UI: Upload → Map columns → Review rows → Approve participants.
- [ ] Require explicit import approval before creating active participant records.
- [ ] Preserve manual participant add as a secondary action.
- [ ] Commit as `feat: add reviewed participant spreadsheet imports`.

### Task 7: Approved outreach and fieldwork operations

**Owner:** Fieldwork agent; begins after Tasks 2, 5, and 6.

**Files:**
- Create: `convex/outreachBatches.ts`, `src/features/fieldwork/*`.
- Modify: `convex/participantInvites.ts`, `convex/interviews.ts`, `convex/callRecords.ts`, `convex/studyParticipants.ts`.

**Produces:** Approved outreach batch creation/launch, provider-safe retries, consent, and complete participant state transitions.

- [ ] Test that unapproved plan/questionnaire/import combinations cannot contact anyone.
- [ ] Test idempotent batch launch and retry so a repeated action does not duplicate email/calls.
- [ ] Snapshot participant IDs, channel selection, and questionnaire version when the user approves launch.
- [ ] Route all Resend and ElevenLabs calls through the batch launcher.
- [ ] Reserve batch credits before launch, debit email only after provider acceptance, and finalize voice credits from connected duration when the call record resolves.
- [ ] Add suppression/declined/consent checks immediately before provider calls.
- [ ] Advance participant status on invite open, consent, interview start, completion, failure, and decline.
- [ ] Build fieldwork summary, participant status table, response master/detail, transcript, summary, and retry controls.
- [ ] Commit as `feat: govern outreach and fieldwork`.

### Task 8: Respondent Canvas and interview persistence

**Owner:** Respondent experience agent; can begin UI after Task 3 and integrate after Task 7.

**Files:**
- Refactor `src/InterviewPrototype.tsx` into `src/features/respondent/*`.
- Modify: `convex/interviews.ts`, `convex/participantInvites.ts`, `src/App.tsx`.

**Produces:** Branded, consented, resumable typed/voice participant experience.

- [ ] Test invalid/expired/completed invite behavior, consent refusal, typed resume, answer persistence, voice fallback, and completion.
- [ ] Apply the organization brand snapshot from the outreach batch.
- [ ] Capture AI/recording consent before starting either channel.
- [ ] Persist each typed answer and voice session completion against participant and questionnaire version.
- [ ] Remove the current hard-coded fallback questionnaire from real invite flows; show a clear configuration error instead.
- [ ] Verify keyboard-only use and small-screen rendering.
- [ ] Commit as `feat: complete the respondent research experience`.

### Task 9: Evidence normalization and analysis

**Owner:** Analysis agent; begins after response contracts from Tasks 7 and 8.

**Files:**
- Create: `convex/evidence.ts`, `convex/analysisActions.ts`, `convex/findings.ts`, `src/features/analysis/*`.
- Modify: `convex/callRecords.ts`, `convex/interviews.ts`.

**Produces:** `startAnalysis`, `getAnalysis`, `listFindings`, and `getEvidenceDetail`.

- [ ] Test that every finding contains at least one supporting evidence ID and that missing evidence fails validation.
- [ ] Normalize typed answers and transcript spans into `responseEvidence`.
- [ ] Generate question, segment, theme, contradiction, and limitation views from one response snapshot.
- [ ] Reserve analysis credits and finalize them from the exact model usage recorded for the analysis run.
- [ ] Store supporting and conflicting evidence IDs on findings.
- [ ] Build evidence drawers that open the exact participant answer or transcript timestamp.
- [ ] Distinguish provisional analysis while fieldwork runs from the final analysis snapshot.
- [ ] Commit as `feat: add traceable research analysis`.

### Task 10: Branded report editor and PDF/PPTX exports

**Owner:** Reporting agent; begins after Tasks 4 and 9.

**Files:**
- Create: `convex/reports.ts`, `convex/reportActions.ts`, `src/features/report/*`, `scripts/render-report.mjs`.
- Add: `tests/fixtures/report-study.json`, report rendering/export tests.

**Produces:** `generateReport`, `updateReportSection`, `publishReport`, `getReportDownloadUrl`.

- [ ] Define structured report sections: cover, executive decision, key findings, segment differences, counter-evidence, recommendations, methodology/sample, limitations, and appendix.
- [ ] Test that report claims reference findings and that report generation snapshots analysis + brand.
- [ ] Build the report editor with section navigation, inline edits, generation progress, evidence links, and brand preview.
- [ ] Render a branded PDF and PPTX from the same structured report document.
- [ ] Reserve report-generation credits, record exact OpenAI/image/export usage internally, and finalize one understandable customer charge.
- [ ] Store exports in Convex storage and expose signed download URLs only to workspace users.
- [ ] Render the fixture report and visually inspect every PDF page and PPTX slide for clipping, overflow, missing fonts, incorrect colors, and broken evidence labels.
- [ ] Commit as `feat: export branded research reports`.

### Task 11: Integration cleanup and usability audit

**Owner:** Lead agent

**Files:**
- Delete: `src/Portal.tsx` after all routes migrate.
- Modify: `src/App.tsx`, `src/index.css`, `README.md`, `.env.example`, `package.json`.
- Create: `docs/HACKATHON_DEMO.md`, `tests/e2e/study-lifecycle.spec.ts`.

**Produces:** One clean demo journey and reproducible setup instructions.

- [ ] Remove customer links and dead UI for Management, Evals, Observability, roles, and appointments while retaining the new Billing page.
- [ ] Remove stale Hermes product/project names from runtime copy and deployment scripts while preserving the agreed Cloudflare project until its rename is confirmed.
- [ ] Add deterministic demo seed data for one branded company and one complete study.
- [ ] Automate the critical journey: sign in → receive starter credits → buy a Test Mode top-up → create study → approve plan/questionnaire → import workbook → approve participants → launch simulated outreach → complete response → analyze → export PDF/PPTX → inspect debits.
- [ ] Run an accessibility pass for names/roles, focus order, contrast, keyboard operation, errors, and reduced motion.
- [ ] Run a usability pass at desktop/tablet/mobile and record every remaining non-blocking issue in `docs/HACKATHON_DEMO.md`.
- [ ] Run `pnpm lint`, `pnpm test --run`, `pnpm build`, and `pnpm test:e2e`; all must pass.
- [ ] Commit as `chore: complete the Meridian hackathon vertical slice`.

### Task 12: Convex and Cloudflare deployment verification

**Owner:** Lead agent; no sub-agent receives production secrets.

**Files:**
- Modify: `.env.example`, `README.md`, Cloudflare/GitHub workflow files if present.

**Produces:** Verified preview deployment connected to the intended Convex deployment and GitHub repository.

- [ ] Inventory required client, Convex, Dodo, Resend, ElevenLabs, AI provider, LinkUp, Clerk, and optional Laminar environment variables by name only.
- [ ] Set secrets through Convex/Cloudflare/GitHub secret stores; never read or copy a user download `.env` into the repository.
- [ ] Deploy Convex schema/functions and run the smoke query against the deployed URL.
- [ ] Build the frontend with the intended `VITE_CONVEX_URL` and Clerk key.
- [ ] Deploy through the configured GitHub-to-Cloudflare workflow.
- [ ] Verify authentication, Dodo Test Mode checkout/webhook, one AI chat turn, one source upload, one participant import, one usage debit, and one report download in the deployed environment.
- [ ] Record deployment URLs and non-secret configuration names in `README.md`.

---

## 6. Agent dispatch architecture

### Branch and worktree topology

- Integration branch: `codex/meridian-hackathon-v1`, based on current `origin/main`.
- The lead agent remains in the existing isolated Codex worktree and owns the integration branch.
- Every parallel implementer receives a short-lived lane branch and separate sibling worktree created from the same integration commit.
- Lane naming: `codex/meridian-w<NUMBER>-<DOMAIN>`, for example `codex/meridian-w1-billing`.
- Implementers commit only inside their lane. The lead cherry-picks reviewed commits into the integration branch in dependency order.
- Delete lane worktrees only after their commits are integrated and verified; preserve the branches until the final whole-branch review passes.

Only the lead edits shared choke points: `convex/schema.ts`, `src/App.tsx`, package configuration, the route registry, generated Convex types, the lockfile, and cross-feature E2E fixtures. Feature agents create modules/pages behind contracts and report any required shared-file change instead of editing it.

### Concurrency model

This Codex session supports four active agents total. Maximum safe utilization is therefore:

- One lead/integration controller.
- Three simultaneous implementers in isolated lane worktrees.
- Then three simultaneous task reviewers reading lane diffs.
- Then up to three simultaneous fixers on their original lane branches when reviews find Important/Critical issues.
- The lead integrates only review-clean commits and verifies the combined branch after every wave.

### Model and reasoning-effort scheduler

Do not run every task at maximum reasoning effort. The lead assigns effort from risk, ambiguity, blast radius, and reversibility, then can promote a lane if its first test or review reveals hidden complexity.

| Tier | Use for | Default assignments |
|---|---|---|
| **High** | Cross-cutting architecture, money/credits, authorization and consent, ambiguous data transformation, evidence correctness, exports, integration failures, and final review | Lead on Task 2; Tasks 2A, 6, 7, 9, 10; billing reconciliation; final whole-branch reviewer |
| **Medium** | Bounded feature implementation with frozen interfaces, substantial UI state, normal backend modules, and task-level code review | Tasks 3, 3B, 4, 5, 8, 11, 12; most lane reviewers and fixers |
| **Low** | Read-only inventory, deterministic scaffolding, asset manifest/crop production, documentation, fixture generation, and routine smoke checks | Wave 0 prep agents; mechanical portions of Task 3A; demo data/docs; repeated lint/build checks |

Dispatch rules:

- Reserve the strongest/high-effort agent for the current critical-path task; do not spend it on waiting, file inventory, or mechanical CSS.
- Run the first 10–15 minutes of an uncertain lane at its assigned tier. Promote Medium/Low to High when it crosses schemas, authorization, irreversible provider actions, money, PII, or nondeterministic agent output.
- Never downgrade security, payment-webhook, credit-ledger, consent/outreach, evidence-lineage, or destructive data work.
- A lower-effort implementer may build a well-specified surface, but a Medium or High reviewer must inspect any lane that can charge credits, contact a participant, or produce a customer deliverable.
- Use Low only when acceptance criteria and verification are mechanical. Low agents do not make product or architecture decisions.

### Execution waves

```text
Wave 0 — Critical path and parallel preparation
  Lead [HIGH]: Task 1 verification baseline + Task 2 schema/workflow contracts
  Prep agent A [LOW]: read-only UI/design file ownership map
  Prep agent B [MEDIUM]: read-only Dodo/credit contract check
  Prep agent C [LOW]: read-only backend dependency/conflict check

  Gate: schema, route interfaces, test commands, and file ownership frozen

Wave 1 — Platform surfaces
  Lane A [MEDIUM]: Task 3 app shell and Meridian component system
  Lane B [HIGH]: Task 2A prepaid credit/Dodo backend
  Lane C [MEDIUM]: Task 4 knowledge, memory, and brand modules/pages

  Review wave: one fresh reviewer per lane, in parallel
  Integration gate: codegen + unit tests + lint + production build

Wave 2 — Study setup
  Lane D [MEDIUM]: Task 5 overview/chat/plan/questionnaire lifecycle
  Lane E [HIGH]: Task 6 spreadsheet participant import
  Lane F [MEDIUM]: Task 3B billing and usage UI

  Review wave: one fresh reviewer per lane, in parallel
  Integration gate: workflow invariants + billing reservation tests + build

Wave 3 — Fieldwork and evidence
  Lane G [HIGH]: Task 7 outreach and fieldwork operations
  Lane H [MEDIUM]: Task 8 respondent Canvas and persistence
  Lane I [HIGH]: Task 9 evidence normalization and analysis

  Review wave: one fresh reviewer per lane, in parallel
  Integration gate: simulated outreach-to-evidence E2E + accessibility smoke

Wave 4 — Outputs and visual polish
  Lane J [HIGH]: Task 10 report editor and PDF/PPTX exports
  Lane K [LOW→MEDIUM for selection]: Task 3A OpenAI-generated product asset family
  Lane L [HIGH]: billing reconciliation and cross-operation usage audit/fixes

  Review wave: one fresh reviewer per lane, in parallel
  Integration gate: rendered export QA + every billable path reconciles

Wave 5 — Finalization
  Lane M [MEDIUM]: Task 11 demo seed and critical-path E2E
  Lane N [MEDIUM]: accessibility/responsive/usability audit fixes
  Lane O [MEDIUM]: Task 12 deployment configuration and Test Mode smoke checks

  Review wave: one fresh reviewer per lane, in parallel
  Integration gate: full lint + test + build + E2E + deployed smoke

Final gate — Most capable independent reviewer [HIGH]
  Review the complete merge-base-to-HEAD diff
  One consolidated fix agent handles all final findings
  Re-run the complete verification matrix
```

### Agent packet and review contract

Each implementer receives only:

- A generated task-brief file extracted from this plan.
- Its lane worktree path and exact file ownership list.
- Relevant interfaces from Task 2, without the full conversation history.
- Required failing tests, verification commands, and expected behavior.
- A report-file path and the required status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, or `BLOCKED`.
- A prohibition on touching shared choke-point files or secrets.
- A requirement to implement with TDD, commit intentionally, and self-review before reporting.

Each task then receives a fresh review agent with the task brief, implementer report, and a generated diff package. The reviewer must independently return both spec-compliance and code-quality verdicts. Important/Critical findings return to a fixer and then the same task is re-reviewed. Minor findings enter the durable progress ledger and the final reviewer receives that list.

The lead maintains `.superpowers/sdd/progress.md` with task status, commit ranges, review results, and unresolved minor findings. This ledger plus Git history is the recovery source after context compaction.

The lead integrates one clean task at a time, even when three tasks finish together. After each cherry-pick it runs the task's focused verification; after the full wave it runs Convex code generation, type checking, unit tests, lint, and production build. Parallelism is used inside independent lanes, never by allowing multiple agents to mutate the integration branch simultaneously.

---

## 7. Definition of done

The hackathon build is complete when a fresh signed-in workspace can demonstrate this without manual database edits:

1. Receive a large starter balance, complete a Dodo Test Mode top-up, and see the verified webhook add credits exactly once.
2. Add a company website and files; see processing complete, company memory update, and a small understandable credit debit.
3. Configure a brand and see it reflected in participant/report previews.
4. Create a study and discuss it with the strategist.
5. Review and approve a plan.
6. Generate, edit, and approve the questionnaire.
7. Upload a realistic XLSX/CSV, review mappings/errors/duplicates/suppression, and approve valid participants.
8. Approve and launch email and/or ElevenLabs outreach.
9. Complete at least one typed or voice response with consent and persisted status.
10. Generate findings and open the response evidence behind them.
11. Generate, edit, and download a branded PDF and PPTX.
12. Inspect study/operation usage, verify reservations settled, and verify the zero-balance hard stop.
13. Reload at every stage without losing persisted work.
14. Complete lint, type/build, unit, and critical-path E2E checks successfully.

## 8. Explicit post-hackathon backlog

- Workspace roles and permissions.
- Recurring subscriptions, overage, proration, saved payment methods, automated refunds, live-money reconciliation, and accounting exports.
- Google Drive, Notion, Slack, CRM, and warehouse connectors.
- External participant enrichment.
- Full appointments/calendar and time-zone scheduling.
- Quotas, screeners, panels, incentives, and complex campaigns.
- Production consent/legal/retention policy management.
- Memory provenance, citations, confidence, locking, and conflict resolution.
- Advanced agent-management, cost controls, observability, and release-gated eval UI.
- Human call takeover, clip editing, and full media studio.
- Enterprise SSO, regional data residency, and compliance certifications.
