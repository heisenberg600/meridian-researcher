# Meridian End-to-End Wiring Design

## Objective

Turn the already-tested Meridian domain slices into the active customer workflow without rewriting the application shell. A signed-in user must be able to create a study, approve its plan, generate and approve a questionnaire, review participants, govern outreach, inspect fieldwork, run evidence-backed analysis, and generate branded report exports.

## Architecture

Keep Convex as a modular monolith and React/Vite as the client. Existing workflow, billing, import, evidence, and export contracts remain authoritative. New work closes missing boundaries: one OpenAI runtime, background knowledge processing, provider execution through outreach deliveries, Convex-backed report persistence, and route adapters that mount the new feature pages inside the current Portal.

## Workstreams

1. **Provider and knowledge runtime:** centralize server-side OpenAI configuration and exact usage accounting; process queued knowledge links/files into summaries and schedule simple company/study memory refreshes.
2. **Outreach and fieldwork:** make approved outreach deliveries the only external email/voice path, with suppression/consent checks immediately before provider calls, stable idempotency, voice-duration settlement, and participant lifecycle updates.
3. **Analysis and reports:** expose persisted evidence/analysis through active queries; add report draft/version mutations, brand/analysis snapshots, storage-backed PDF/PPTX exports, and authorized download URLs.
4. **Product integration:** mount Fieldwork, Analysis, Report, and Study Memory within active study navigation; preserve plan approval and participant import; remove dead fallback behavior where it can bypass governed flows.

## Data and Safety Invariants

- Browser code never receives provider secrets.
- Billable calls reserve credits first and reconcile exact provider usage afterward.
- No external outreach occurs without approved plan, questionnaire, participant batch, and outreach snapshot.
- Participant enrichment never uses external sources.
- Analysis findings always link to supporting evidence in the frozen snapshot.
- Reports snapshot analysis and brand state and expose downloads only after organization access checks.
- The Cloudflare project remains `hermes-researcher` until a replacement project is confirmed.

## Error Handling

Provider/configuration failures return actionable, non-secret messages and release unused reservations. Long-running jobs persist queued/running/ready/failed status. UI surfaces loading, empty, failure, retry, and insufficient-credit states instead of toast-only feedback.

## Verification

Each workstream follows test-first changes and focused verification. The integration gate is Convex codegen, the complete unit/backend suite, production build, lint, and configured Playwright desktop/mobile smoke coverage for the governed study path.
