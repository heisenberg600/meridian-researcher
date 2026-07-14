# Convex Agent Platform Plan

## 1. Goal

Meridian should become an AI-powered product and market research company platform:

```text
Business decision
  -> AI research strategy
  -> human approval
  -> fieldwork execution
  -> AI interviews and forms
  -> traceable evidence synthesis
  -> decision report
```

The target backend is Convex. The agent runtime should reuse the useful patterns from the Meridian agent in `knowsis-ai-backend`: tool calling, a private bash workspace, skill loading, artifacts, bounded internal delegation, cost tracking, and resumable streamed responses.

The product should expose one primary agent to the user. The user should not have to choose between multiple modes. Agent behavior should be driven by the current study state, active skills, available tools, approval gates, and sandbox context.

## 2. Key Architectural Decision

Use Convex as the system of record and coordination layer. Use a Meridian-style bash sandbox as the agent's execution environment, not as the database.

Convex owns:

- organizations, users, studies, participants, approvals, and state transitions
- messages, run records, tool events, artifacts, costs, and audit logs
- study plan versions, interview brief versions, interview records, evidence, and reports
- real-time UI subscriptions
- scheduled work, workflow status, retries, and queue visibility

The bash sandbox owns:

- temporary calculations
- structured notes and intermediate files
- CSV/document transformations
- local deterministic validation scripts
- generated exports before registration
- persistent per-agent workspace snapshots

This keeps research governance inspectable while preserving the power of an agent that can work in a constrained `/workspace`.

## 3. What To Reuse From Meridian

The Meridian framework has several reusable ideas:

- `MeridianWorkspace`: a virtual `/workspace` with command limits, file limits, checkpointing, and skill files.
- `artifact_register`: a durable bridge from generated workspace files to user-visible artifacts.
- `delegate_task`: bounded internal delegation for research, analysis, review, extraction, or writing when the main agent needs parallel help.
- tool recovery: failed tools return structured errors and increment metrics instead of crashing the whole run.
- usage tracking: every agent and delegated step records model, token, cost, source, and metadata.
- stream lifecycle controls: active stream locks prevent concurrent writes to one conversation.

These should be ported conceptually, not copied wholesale. Replace Postgres, Redis, GCS, QStash, and Fastify-specific pieces with Convex tables, Convex storage, actions, scheduler/workflows, and HTTP actions where needed.

## 4. Proposed System Shape

```text
React/Next app
  -> Convex queries/mutations for live product state
  -> Convex actions for LLM calls, tool orchestration, embeddings, external APIs
  -> Convex Workflow/Workpool for durable research jobs
  -> Bash sandbox worker for workspace execution
  -> Convex storage for uploads, transcripts, exports, and workspace snapshots
```

### Convex functions

- Queries: read studies, chat messages, participants, fieldwork status, evidence, reports.
- Mutations: create studies, approve plans, import participant metadata, append audit events, register artifacts.
- Actions: call LLMs, generate embeddings, run agent steps, invoke bash sandbox commands, send email/SMS/calls later.
- Scheduled functions/workflows: retries, reminders, fieldwork waves, analysis jobs, report regeneration.

### Bash sandbox worker

There are two viable implementations:

1. In-process action sandbox using `just-bash`/`bash-tool`, if Convex's Node action runtime supports the needed package behavior and resource profile.
2. External worker service exposing a narrow API: open workspace, execute command, read file, write files, checkpoint. Convex actions call it over HTTP.

Start with option 1 for local development. Keep the interface abstract so production can move to option 2 if Convex action runtime limits become painful.

## 5. Behavior Model: One Agent, Skill-Driven

Meridian should have one user-facing agent. Internally, that agent can behave like a strategist, study designer, interviewer, analyst, or reviewer, but those are capabilities activated by skills and workflow state rather than separate visible modes.

The agent's behavior should be determined by:

- current study state, such as `draft`, `awaiting_plan_approval`, `brief_approved`, `fieldwork_running`, or `analyzing`
- active skill pack, such as `research-strategy`, `study-design`, `interviewer`, or `analysis-report`
- available tools for that state
- immutable approved artifacts, such as Study Plan and Interview Brief versions
- approval gates enforced by Convex mutations
- files, notes, and outputs in the sandbox workspace

This keeps the UI simple: the user talks to Meridian. Meridian chooses the right skill and tools based on where the study is.

### Why skills first

Skills are a good fit for the early product because they are explicit, inspectable, and easy to change without redesigning the whole runtime. They let us encode research craft as versioned instructions:

- how to create a Study Plan
- how to check for leading questions
- how to convert a plan into an Interview Brief
- how to run a neutral interview
- how to synthesize evidence into findings
- how to write limitations and confidence statements

Skills should not replace product logic. They guide the agent's reasoning and output format. Convex mutations still enforce state transitions, approvals, permissions, and data integrity.

### Skill shape

A skill should include:

- `name`
- `description`
- `when_to_use`
- required inputs
- allowed tools
- output contract
- validation checklist
- examples or templates when useful

Example skill set for the first vertical slice:

- `research-strategy`: turns the business decision into a Study Plan.
- `study-plan-review`: validates fixed headings, assumptions, hypotheses, risks, and decision criteria.
- `interview-brief-design`: converts an approved Study Plan into a structured Interview Brief.
- `question-quality-review`: checks leading language, ambiguity, duplication, and sensitivity.
- `ai-interviewer`: conducts an interview within the approved brief.
- `evidence-extraction`: turns transcripts into evidence items and topic coverage.
- `analysis-report`: creates findings, counter-evidence, limitations, and recommendations.

### When not to use skills

Use code, schemas, and Convex mutations instead of skills for:

- approval gates
- permissions
- participant contactability rules
- immutable versioning
- audit logging
- evidence linking requirements
- artifact registration
- billing and cost records

Skills should tell the agent how to do good research. Code should decide what is allowed.

## 6. Core Data Model

Minimum Convex tables:

- `organizations`: company account and settings.
- `memberships`: user role per organization.
- `studies`: title, business decision, status, owner, current approved versions.
- `studyMessages`: strategist/interviewer/analyst conversations.
- `agentRuns`: run metadata, active skill names, model, status, active lock, cost.
- `agentToolEvents`: tool call inputs, outputs, timings, failures, redactions.
- `workspaceSnapshots`: session/study scoped snapshot metadata and storage ids.
- `agentSkills`: global, organization-scoped, or user-scoped skills.
- `studySkillActivations`: selected skill versions for a study or run.
- `studyPlanVersions`: Markdown plan, status, approvedBy, approvedAt.
- `interviewBriefVersions`: structured JSON execution contract, status, approvedBy, approvedAt.
- `approvals`: explicit approval records for plan, brief, outreach, material changes.
- `participants`: imported or recruited people, attributes, consent/contactability.
- `participantSegments`: segment definitions and quotas.
- `outreachCampaigns`: approved outreach waves, templates, status, limits.
- `interviews`: participant session state, consent, brief version, transcript refs.
- `interviewRecords`: structured topic coverage and evidence references.
- `evidenceItems`: quotes, clips, source spans, tags, participant and segment refs.
- `findings`: claim, support, counter-evidence, confidence, limitations.
- `reports`: generated decision reports and exports.
- `artifacts`: files registered from workspace or uploads.
- `usageLedger`: tokens, model, provider, operation, cost.
- `auditEvents`: human and agent actions, before/after metadata, policy gates.

## 7. Internal Capabilities

These are internal capabilities of the single Meridian agent, not separate user-facing agents.

### Research Strategy

Purpose: turn a business decision into an approvable Study Plan.

Tools:

- read uploaded context
- web/company research, with permission and citation rules
- bash workspace for synthesis and tables
- plan validator
- artifact registration for exports

Outputs:

- Markdown Study Plan with fixed headings
- open questions
- approval request

Primary skills:

- `research-strategy`
- `study-plan-review`

### Study Design

Purpose: convert an approved Study Plan into a structured Interview Brief.

Tools:

- bias/neutrality checker
- duration estimator
- consent language generator
- screener and outreach template generator
- brief validator

Outputs:

- versioned JSON Interview Brief
- human-readable guide
- approval request

Primary skills:

- `interview-brief-design`
- `question-quality-review`

### Interviewing

Purpose: collect evidence within the approved brief.

Tools:

- participant context lookup
- consent capture
- topic coverage tracker
- neutral probe selector
- transcript/record writer

Outputs:

- transcript or answer log
- structured Interview Record
- quality flags

Primary skills:

- `ai-interviewer`
- `evidence-extraction`

### Analysis

Purpose: synthesize evidence into findings and a decision report.

Tools:

- evidence retrieval
- cohort comparison
- contradiction/minority-view detection
- report writer
- reviewer subagent

Outputs:

- findings linked to evidence
- limitations and confidence
- decision report

Primary skills:

- `analysis-report`
- `study-plan-review`

## 8. Approval And Governance Rules

Hard invariants:

- No approved Study Plan means no Interview Brief generation.
- No approved Interview Brief means no interviews or outreach.
- No approved outreach campaign means no participant contact.
- Material study changes create a new version and require approval.
- Every finding must link to supporting and, when present, conflicting evidence.
- Agents can recommend changes; only humans approve state transitions.

Implement these invariants inside Convex mutations. Actions can propose changes but should not directly bypass approval mutations.

## 9. Bash Sandbox Contract

The sandbox should expose a small internal API:

```ts
type WorkspaceScope = {
  orgId: string;
  userId: string;
  studyId: string;
  sessionId: string;
};

type SandboxCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};
```

Required operations:

- `openWorkspace(scope)`: acquire a per-session lease and restore snapshot.
- `executeCommand(scope, command)`: run under `/workspace` with timeout and output limits.
- `readFile(scope, path)`: read a workspace file.
- `writeFiles(scope, files)`: write agent-created files.
- `checkpoint(scope)`: archive `/workspace` and save to Convex storage.
- `closeWorkspace(scope)`: checkpoint and release lease.

Limits to keep from Meridian:

- command timeout around 20 seconds for normal steps
- maximum command count and loop iterations
- maximum output characters
- maximum file count
- maximum uncompressed and compressed workspace size
- no direct network access from the sandbox
- managed skills live under `/workspace/.agents/skills`
- artifacts must be under `/workspace` and outside managed skill files

## 10. Streaming And Long-Running Work

Convex should store the stream state instead of relying on a single HTTP connection as the source of truth.

Recommended approach:

- `startAgentRun` mutation creates `agentRuns` row with status `queued`.
- workflow/action picks it up, sets status `running`, and appends message/tool deltas.
- UI subscribes to `studyMessages`, `agentRuns`, and `agentToolEvents`.
- every LLM/tool step commits durable progress.
- on failure, action records structured error and closes workspace.
- on resume/retry, action rehydrates from messages and workspace snapshot.

For interactive chat, the frontend can still display token-level or chunk-level updates, but correctness should rely on Convex records.

## 11. First Vertical Slice

Build one complete supervised research loop before building all channels.

Scope:

1. Create organization and study.
2. Start a Strategist chat from a business question.
3. Generate a versioned Markdown Study Plan.
4. Human approves or requests revision.
5. Generate a structured Interview Brief from approved plan.
6. Human approves the brief.
7. Import participants from CSV.
8. Run mock text interviews inside the app, not phone/email yet.
9. Produce Interview Records with evidence spans.
10. Generate an Analyst report with traceable findings.

This avoids telecom, scheduling, deliverability, and consent edge cases while validating the core research value.

## 12. Migration Phases

### Phase 0: Repo and Convex baseline

- Add Convex app to this repo.
- Connect it to the existing deployment: `klaude-killers / giddy-tiger-344`.
- Define schema for studies, messages, runs, approvals, artifacts, and usage.
- Add auth/org scaffolding.
- Add local dev scripts that work from bash only.

Acceptance:

- `pnpm dev` runs frontend and Convex locally.
- user can create a study and see live state updates.

### Phase 1: Single-agent sandbox runtime

- Create `AgentRuntime` abstraction.
- Add skill loader and active skill selection.
- Implement parent agent loop with Vercel AI SDK tool calling.
- Implement Convex-backed run/message persistence.
- Implement basic bash workspace tool.
- Implement usage ledger and tool events.

Acceptance:

- Meridian can answer using the active study skill and sandbox.
- sandbox can create/read/checkpoint files.
- all tool calls and costs appear in Convex.

### Phase 2: Study plan and approval gate

- Add Study Plan generator.
- Add Markdown section validator.
- Add approve/revise mutations.
- Add immutable approved plan versions.

Acceptance:

- no brief can be generated until a plan is approved.
- revision history and audit log are visible.

### Phase 3: Interview brief generation

- Add structured JSON schema for Interview Brief.
- Add validation for topic ids, objectives, priorities, time budgets, prohibited assumptions, completion criteria.
- Add human-readable guide view.

Acceptance:

- no interview can start until a brief is approved.
- brief versions are immutable after approval.

### Phase 4: Mock interviews

- Add participant import.
- Add text interview UI.
- Implement AI Interviewer using approved brief only.
- Store transcripts, topic coverage, and structured records.

Acceptance:

- interviewer asks adaptive neutral follow-ups.
- every interview record references plan and brief versions.

### Phase 5: Evidence and report

- Add evidence extraction.
- Add vector/text search over transcripts and records.
- Add Analyst Agent.
- Add finding/evidence linking.
- Add report export artifact.

Acceptance:

- generated report links each claim to participant evidence.
- report states sample limitations and counter-evidence.

### Phase 6: Real fieldwork channels

- Add outreach campaigns, templates, contact limits, opt-outs.
- Integrate email first.
- Add scheduling and reminders.
- Later add phone/voice interviews.

Acceptance:

- no contact happens without approved campaign.
- contactability and opt-outs are enforced in mutations.

## 13. Bash-Only Developer Workflow

The project should be operable without clicking around in dashboards after initial credentials are configured.

Recommended scripts:

```json
{
  "dev": "concurrently \"next dev\" \"convex dev\"",
  "convex:dev": "convex dev",
  "convex:deploy": "convex deploy",
  "test": "vitest run",
  "lint": "biome check .",
  "format": "biome check --write .",
  "seed": "tsx scripts/seed.ts",
  "sandbox:smoke": "tsx scripts/sandbox-smoke.ts"
}
```

Required environment variables:

- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- LLM provider keys
- `LINKUP_API_KEY` for agent web search
- auth provider configuration
- optional external sandbox worker URL
- optional email/voice provider keys in later phases

The dashboard URL is useful for inspection, but routine development should work through CLI commands, local tests, and Convex deploys.

## 14. Main Risks

- Convex action runtime may not be ideal for a full in-process bash sandbox. Keep the sandbox behind an interface so it can move to a worker.
- Long-running voice/interview workflows need durable orchestration. Use Convex Workflow or Workpool rather than ad hoc polling.
- Research governance must live in mutations, not prompts.
- Skills can become a hidden policy layer if overused. Keep permissions, approvals, and invariants in code.
- Skill selection can become vague. Store the active skill versions on each run so behavior is debuggable.
- Evidence traceability must be built into the schema from day one.
- Participant outreach has legal and compliance risk. Ship mock/in-app interviews first.
- Vector search may need careful chunking and metadata filtering for participant evidence.

## 15. Immediate Next Steps

1. Scaffold Convex in this repo.
2. Add schema for the first vertical slice.
3. Implement study creation and real-time study workspace.
4. Implement a minimal single Meridian agent with skill loading.
5. Add bash sandbox smoke test.
6. Create the first skill: `research-strategy`.
7. Build Study Plan generation and approval gate.
8. Then add Interview Brief generation.
