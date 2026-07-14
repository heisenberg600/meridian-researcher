# High-Level Product Components

## 1. Purpose

Meridian helps a company define, run, and analyze customer research. It should behave like a supervised AI research team rather than only a survey builder, dialer, or transcript summarizer.

The product begins with a commercial decision and ends with a recommendation backed by inspectable participant evidence.

## 2. End-to-end system

```text
Business context
      ↓
Research strategy and study design
      ↓
Human review and approval
      ↓
Participant import and segmentation
      ↓
Outreach, screening, and scheduling
      ↓
Forms and AI-led interviews
      ↓
Transcription and evidence processing
      ↓
Analysis and research-quality checks
      ↓
Decision report and evidence explorer
```

## 3. Major product components

### 3.1 Organization and Study Workspace

The workspace is the control center for each research project.

Responsibilities:

- User authentication and organization membership
- Study creation, ownership, status, and lifecycle
- A shared timeline of actions, approvals, and changes
- Role-based access for study owners, researchers, reviewers, and viewers
- Study settings, files, integrations, and exports
- Navigation across planning, fieldwork, and results

A study should move through explicit states such as `Draft`, `Awaiting approval`, `Ready`, `Running`, `Paused`, `Analyzing`, and `Completed`.

### 3.2 Research Strategist

The Research Strategist converts an ambiguous business question into a researchable plan.

Inputs:

- Business question or decision
- Text or voice conversation
- Product website
- Uploaded briefs, prior studies, presentations, and spreadsheets
- Available customer or product context

Outputs:

- Restated decision
- Research objectives
- Hypotheses and unknowns
- Evidence needed to make the decision
- Recommended method
- Target audience and sample structure
- Risks, assumptions, and limitations

The strategist should ask only necessary clarification questions and explain why the proposed research can inform the decision.

### 3.3 Study Designer

The Study Designer turns the approved strategy into fieldwork materials.

Responsibilities:

- Create interview guides and questionnaires
- Create participant screeners
- Define universal questions and conditional branches
- Generate neutral follow-up probes
- Estimate and enforce interview duration
- Create consent language and participant instructions
- Create outreach templates
- Validate questions for leading language, duplication, ambiguity, and bias
- Version all approved study instruments

The company must approve the study design before outreach begins.

### 3.4 Participant and Sample Manager

This component manages who should participate and whether the sample matches the study plan.

Responsibilities:

- CSV and spreadsheet import
- Later: CRM and data-warehouse integrations
- Field mapping, validation, deduplication, and suppression
- Participant profiles and known attributes
- Segments, cohorts, quotas, and eligibility rules
- Consent and contactability status
- Recruitment progress and sample-coverage monitoring
- Separation of customers, churned users, non-buyers, and other cohorts

Known participant information can personalize an interview, but uncertain or stale attributes must not be treated as fact.

### 3.5 Outreach and Scheduling Coordinator

This component contacts approved participants and manages the logistics of participation.

Channels may include:

- Email
- SMS or WhatsApp, where compliant and supported
- Scheduled or immediate phone calls
- Shareable recruitment links

Responsibilities:

- Human-approved outreach campaigns
- Personalized invitations
- Delivery, response, bounce, and opt-out tracking
- Reminder and retry policies
- Screening and qualification
- Scheduling and rescheduling
- Calling windows, time zones, and frequency limits
- Suppression lists and contact preferences
- Handoff into the selected research experience

The system must never autonomously contact an unapproved audience.

### 3.6 Research Experience and AI Interviewer

This is the participant-facing experience.

Modes:

- Structured forms and surveys
- Asynchronous text or voice responses
- Real-time AI voice interviews
- A future human-moderated or hybrid mode

AI interviewer responsibilities:

- Introduce the study and capture consent
- Follow the approved guide and version
- Use known context to avoid unnecessary questions
- Ask neutral, adaptive follow-ups
- Detect confusion, shallow answers, contradictions, and non-answers
- Allow interruption and natural conversation
- Maintain time and question-priority budgets
- Respect withdrawal and terminate safely
- Produce recordings and transcripts when permitted

Personalization must not remove the common questions required to compare participants.

### 3.7 Fieldwork Operations and Quality Monitor

This component gives researchers operational visibility while a study runs.

Responsibilities:

- Track invited, scheduled, active, completed, failed, declined, and disqualified participants
- Surface call, survey, consent, and recording failures
- Monitor quotas and missing segments
- Detect unusually short, low-quality, duplicate, or suspicious responses
- Monitor interview duration and completion rates
- Show provisional themes without presenting them as final conclusions
- Pause fieldwork when safety, compliance, or quality thresholds are breached

### 3.8 Adaptive Research Engine

The adaptive engine evaluates whether the running study is collecting useful evidence.

It may identify:

- Questions producing repetitive or generic answers
- Questions that participants misunderstand
- Missing probes around emerging themes
- Underrepresented segments
- Paths exceeding the time budget
- Leading questions or systematic response bias
- Saturation and unresolved evidence gaps

It may recommend rewording, reprioritizing, adding a probe, changing branch logic, extending a quota, or running a follow-up wave.

Material changes always require human approval. Approved changes create a new instrument version, and every response remains attached to the version used.

### 3.9 Evidence and Analysis Engine

This component converts raw responses into structured, traceable research evidence.

Responsibilities:

- Transcription and speaker separation
- Searchable storage of recordings, transcripts, form answers, and metadata
- Theme and code extraction
- Comparison across segments, geographies, and behaviors
- Contradiction and minority-view detection
- Representative quote and clip selection
- Evidence coverage and strength assessment
- Instrument-version effect analysis
- Distinction between observations, interpretations, and recommendations

Every generated claim should retain links to its supporting and conflicting source evidence.

### 3.10 Decision Report and Evidence Explorer

The output should answer the original business decision rather than merely summarize questions.

The report should contain:

- Recommended decision or action
- Reasons and supporting evidence
- Commercial implications
- Risks, counter-evidence, and minority views
- Segment and cohort differences
- Sample description and recruitment method
- Confidence, limitations, and remaining unknowns
- Recommended next action or follow-up study

The Evidence Explorer lets users inspect transcripts, recordings, clips, answers, participant context, and study-instrument versions behind each claim. Users should also be able to ask follow-up questions against the evidence corpus.

## 4. Cross-cutting platform capabilities

These concerns apply to every major component rather than forming isolated workflow steps.

### 4.1 Human approval and governance

- Explicit approval before study launch
- Explicit approval before outreach
- Explicit approval before material instrument changes
- Ability to pause or stop fieldwork
- Audit trail for agent and human actions
- Clear separation between AI recommendations and approved actions

### 4.2 Consent, privacy, and compliance

- Participation and recording consent
- Opt-out and withdrawal handling
- Purpose limitation and data minimization
- Retention and deletion policies
- Regional calling hours and outreach controls
- Encryption and access control
- AI disclosure where required
- Restrictions on using participant quotations and recordings

Legal requirements vary by jurisdiction and require expert review before production use.

### 4.3 Research rigor

- Neutral question checks
- Transparent sampling and recruitment
- Bias and limitation reporting
- No unsupported population-level claims
- Shared comparison questions across personalized interviews
- Instrument versioning
- Traceability from findings to evidence

### 4.4 Integrations

Potential integration families include:

- CRM and customer data
- Email delivery
- Telephony and voice AI
- Calendar and scheduling
- File and document storage
- Product analytics and data warehouses
- Collaboration and report exports

Integrations should be added only when they perform real work in the golden path.

### 4.5 Agent orchestration and observability

- Shared study context across AI roles
- Structured handoffs between strategy, design, outreach, interviewing, and analysis
- Permission-aware tools
- Prompt and model version tracking
- Cost, latency, error, and quality monitoring
- Retry and recovery behavior
- Evaluation datasets for research quality

The named AI roles can initially be logical modules in one application. They do not need to be independently deployed agents.

## 5. Suggested MVP boundary

The first version should prove one complete path for existing-customer qualitative research:

1. A company enters a D2C business question.
2. The Research Strategist creates objectives and a qualitative study plan.
3. The Study Designer creates an interview guide and outreach copy.
4. A human reviews and approves the study.
5. The company uploads a small participant CSV.
6. The product previews participant-specific interview paths.
7. An approved test invitation is sent, or a controlled interview link is opened.
8. One participant completes a real AI voice interview.
9. Seeded interviews supplement the live demo evidence.
10. The system generates transcripts, themes, and an adaptive-study recommendation.
11. A human approves the recommendation and creates questionnaire version 2.
12. A decision report links every major claim to evidence and shows limitations.

## 6. MVP versus later

### MVP

- One organization and basic study workspace
- Text-based strategy conversation, with voice if time permits
- Study plan and interview-guide generation
- CSV participant import
- Email invitation or controlled interview link
- One real AI voice interview path
- Recording and transcription
- Seeded evidence for multi-interview analysis
- Basic adaptive recommendation and human approval
- Decision report with evidence citations

### Later

- Participant marketplace or external panel
- Broad CRM and warehouse integrations
- Multi-channel production outreach
- Multilingual interviewing at scale
- Advanced quantitative survey methods and weighting
- Human moderator marketplace
- Enterprise permissions and billing
- Fully automated recruitment and incentives
- Cross-study knowledge repository and benchmarking

## 7. Product boundaries

Meridian is not initially:

- A general-purpose mass-email or autodialing platform
- A participant scraping tool
- A replacement for legal or compliance review
- A full market-intelligence suite
- A guarantee that small samples represent a population
- A dashboard that hides the evidence behind AI-generated conclusions

## 8. Component dependency map

```text
Organization & Study Workspace
 ├── Research Strategist
 │    └── Study Designer
 ├── Participant & Sample Manager
 │    └── Outreach & Scheduling Coordinator
 │         └── Research Experience & AI Interviewer
 ├── Fieldwork Operations & Quality Monitor
 │    └── Adaptive Research Engine
 └── Evidence & Analysis Engine
      └── Decision Report & Evidence Explorer

Across all components:
Governance • Consent & Privacy • Research Rigor • Integrations • Observability
```

## 9. Next product decisions

Before choosing the technical architecture, the team should decide:

1. The first D2C research use case: churn, repeat purchase, conversion barriers, pricing, or another decision.
2. Whether the first participant experience is browser-based voice, phone-based calling, or both.
3. Whether real email delivery is required for the demo or an approved outreach queue is sufficient.
4. What information the participant CSV must contain.
5. What counts as a material study change requiring approval.
6. The minimum evidence model needed to link claims to quotes, clips, and participants.
7. Which data must be deleted after a study and who can access recordings.
