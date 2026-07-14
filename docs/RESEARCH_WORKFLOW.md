# Research Workflow and Agent Contracts

## 1. Core model

Meridian separates research into three primary agent roles:

```text
Research Strategist
  → Interviews the company
  → Understands the business decision
  → Develops working hypotheses
  → Designs the study

AI Interviewer
  → Interviews consumers
  → Collects evidence
  → Uses neutral, adaptive probes
  → Follows the approved research plan

Analyst Agent
  → Evaluates the collected evidence
  → Tests hypotheses
  → Finds unexpected themes
  → Produces findings and recommendations
```

The Strategist interviews the company or research owner. The Interviewer later speaks with consumers. Hypotheses guide the research but are not treated as findings.

## 2. Workflow and approval gates

```text
Company conversation
        ↓
Draft Study Plan in Markdown
        ↓
Company review and revision
        ↓
Study Plan approval
        ↓
Immutable Approved Study Plan v1
        ↓
Structured Interview Brief generation
        ↓
Brief validation and fieldwork review
        ↓
Interview Brief approval
        ↓
Approved outreach and consumer interviews
        ↓
Structured Interview Records and source evidence
        ↓
Analysis, findings, and recommendations
```

Two invariants govern execution:

```text
No approved Study Plan
  → no Structured Interview Brief

No approved Interview Brief and fieldwork settings
  → no participant outreach or interviews
```

The Study Plan answers: **What research should we conduct and why?**

The Interview Brief answers: **What must the Interviewer learn, and within what boundaries?**

## 3. Study Plan

The Strategist creates a human-readable Study Plan in Markdown. Its headings are fixed so important sections cannot be silently omitted, while the content remains specific to the study.

```markdown
# Study Plan: <title>

## 1. Decision to Inform
## 2. Background and Known Context
## 3. Research Objectives
## 4. Working Hypotheses
## 5. Information We Need to Collect
## 6. Target Participants
## 7. Sample and Cohort Plan
## 8. Research Method
## 9. Interview Approach
## 10. Outreach and Consent
## 11. Analysis Plan
## 12. Decision Criteria
## 13. Risks and Limitations
## 14. Open Questions
## 15. Approval
```

By the end of the Strategist stage, the plan should explain:

- The business decision the research will inform
- What is known, assumed, and still unknown
- Research objectives and working hypotheses
- Evidence that could support or contradict each hypothesis
- Whom to contact and why
- Recommended participant cohorts and sample size
- Recruitment and eligibility requirements
- The information to collect from consumers
- The proposed research method and interview duration
- Outreach, consent, and recording requirements
- How evidence will be analyzed
- How findings will translate into a business decision
- Expected biases, risks, and limitations

A hypothesis is an explanation to investigate, not an answer. The plan must keep facts, assumptions, hypotheses, findings, and recommendations distinct.

## 4. Structured Interview Brief

The Structured Interview Brief is generated only from an approved Study Plan version. It is a machine-readable execution contract for the AI Interviewer.

It should not be a rigid questionnaire containing only exact sentences. Instead, it should define:

- Information goals
- Why each goal matters
- Priority and time budget
- Suggested opening questions
- Possible neutral probes
- Answer signals
- Conditions for exploring or skipping a topic
- Prohibited assumptions
- Completion criteria
- Links to research objectives and hypotheses
- Consent, safety, and termination behavior

Example topic:

```json
{
  "topic_id": "usage_journey",
  "title": "Product usage journey",
  "objective_ids": ["O1"],
  "hypothesis_ids": ["H1", "H2"],
  "purpose": "Understand how product usage evolved and why it changed.",
  "priority": "required",
  "information_to_collect": [
    "Initial usage pattern",
    "How usage changed over time",
    "Current usage status",
    "Reported reasons for any change"
  ],
  "suggested_openers": [
    "Walk me through how you used the product from when you first received it.",
    "Tell me about how the product became part of your routine."
  ],
  "possible_probes": [
    "What happened after that?",
    "What influenced that change?",
    "Can you give me an example?"
  ],
  "explore_if": [
    "The participant describes a meaningful change in usage.",
    "The answer is general and contains no behavioral example."
  ],
  "skip_if": [
    "The required information was already established clearly."
  ],
  "prohibited_assumptions": [
    "Do not assume the participant stopped using the product.",
    "Do not assume packaging caused a change."
  ],
  "completion_criteria": [
    "Initial and current usage are understood.",
    "Any meaningful change and its reported cause have been explored."
  ],
  "time_budget_minutes": 3
}
```

Topic priorities may be:

- `required` — must be covered unless consent is withdrawn
- `high` — should be covered if time permits
- `adaptive` — explore only when triggered
- `optional` — useful but expendable
- `prohibited` — outside the approved scope

The intended principle is:

> Flexible language and conversation; controlled objectives, boundaries, and evidence requirements.

## 5. Interviewer behavior

After every consumer response, the Interviewer should determine:

1. What relevant information was just collected?
2. Which required information remains missing?
3. Is a neutral follow-up valuable?
4. Is the follow-up within the approved scope?
5. How much time remains?
6. Should it probe, clarify, change topic, skip an answered topic, or end?

The Interviewer may:

- Rephrase suggested questions naturally
- Ask relevant follow-up questions
- Change topic order when conversation context warrants it
- Skip information already answered clearly
- Clarify ambiguity or contradictions
- Capture unexpected but relevant themes

The Interviewer may not:

- Introduce new research objectives
- Lead a participant toward a hypothesis
- Treat company assumptions as facts
- Ask unrelated or unnecessarily sensitive questions
- Ignore required coverage without recording why
- continue after consent is withdrawn
- Exceed approved time and scope without authorization
- Change the approved research design

## 6. Structured Interview Record

After an interview, the Interviewer produces both the source transcript or recording references and a structured record of what was collected.

```json
{
  "interview_id": "I12",
  "participant_id": "P42",
  "study_plan_version": 1,
  "interview_brief_version": 1,
  "topic_coverage": [
    {
      "topic_id": "usage_journey",
      "coverage": "complete",
      "collected_information": {
        "initial_usage": "Once daily",
        "current_status": "Stopped",
        "reported_reason": "Participant experienced dryness"
      },
      "evidence": [
        {
          "transcript_start_seconds": 184,
          "transcript_end_seconds": 229,
          "quote": "I used it every morning initially..."
        }
      ]
    }
  ],
  "unexpected_observations": [],
  "quality_flags": []
}
```

Coverage values may include:

- `not_started`
- `partial`
- `complete`
- `not_applicable`
- `declined`
- `unresolved`

Unexpected observations should be captured with evidence, but they must not silently alter the remaining study. A change to future interviews requires a versioned recommendation and human approval.

## 7. Analyst Agent

The Analyst receives:

- The approved Study Plan and its version
- Every approved Interview Brief version
- Structured Interview Records
- Transcripts, recordings, form responses, and relevant operational data

It produces:

- Hypothesis assessments: supported, partially supported, contradicted, inconclusive, or insufficiently tested
- Findings with supporting and conflicting evidence
- Comparisons between cohorts and segments
- Unexpected themes and minority views
- Evidence coverage and saturation assessment
- Limitations and unresolved questions
- Business recommendations linked to the original decision

Every major claim should link to participant evidence. Frequency alone must not determine importance; behavioral impact, cohort relevance, contradictory evidence, and sample limitations also matter.

## 8. Traceability

All major entities require stable IDs so the system can preserve the chain:

```text
Business Decision
  → Objective
  → Hypothesis
  → Information Goal
  → Interview Evidence
  → Finding
  → Recommendation
```

Store concise, decision-relevant rationale rather than unrestricted model chain-of-thought.

## 9. Versioning and change control

Approved artifacts are immutable snapshots.

```text
Study Plan v1 → Interview Brief v1 → Interviews 1–10
Study Plan v2 → Interview Brief v2 → Interviews 11–20
```

Strategic changes require a new Study Plan version and approval. Examples include:

- A new research objective or hypothesis
- A different participant cohort
- A methodology change
- A material sample change
- A new sensitive subject
- Different decision criteria

Operational changes may require only a new Interview Brief version and fieldwork approval. Examples include:

- Rephrasing an opener without changing its intent
- Reordering topics
- Adding a neutral clarification probe
- Adjusting time allocation

No approved artifact is edited in place, and no active interview is silently switched to a new version.

## 10. Artifact ownership

```text
Research Strategist
  → Drafts and revises the Markdown Study Plan
  → Stops at Study Plan approval

Study Compiler
  → Accepts only an approved Study Plan
  → Produces and validates the Structured Interview Brief

AI Interviewer
  → Accepts only an approved Interview Brief
  → Conducts adaptive consumer interviews
  → Produces Structured Interview Records

Analyst Agent
  → Evaluates evidence against the approved plan
  → Produces findings and recommendations
```

The Study Compiler can be an internal service rather than a separately marketed agent.

## 11. Summary principle

The product should be conversational for humans and structured at execution boundaries:

> The Strategist defines the evidence contract. The Interviewer chooses the conversational path needed to fulfill it. The Analyst determines what the collected evidence supports, contradicts, or leaves unresolved.
