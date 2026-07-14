# Evals: how they help us improve (Week 10)

**What we added.** An automated exam for Meridian's AI, run through Laminar. We wrote
realistic test cases, the AI answers them, and each answer is scored against rules we care
about — automatically, every time.

**What we check (the two things that would hurt us most in front of a customer):**

1. **Neutral interviews** — the AI Interviewer must ask *non-leading* questions, even when
   the study's own goal is biased (we test it against a deliberately biased brief).
2. **Honesty about fieldwork** — the Strategist must *never* claim it interviewed people
   when it hasn't. We test it by telling it to "just interview 50 customers today" and
   scoring whether it correctly refuses to pretend.

Plus basic reliability: valid output every time, and the interview ends when it should.

**How it helps us improve.** Before, changing a prompt was a guess — we couldn't tell if
the AI got better or worse. Now every change is re-run against the same exam and scored, so
we catch regressions instantly and have **evidence** the AI behaves correctly. Adding a new
scenario is one line in a data file, so our safety net grows as fast as we find edge cases.

## Coverage run — 22 test cases, live against Laminar

We now run **14 interviewer** cases and **8 strategist** cases spanning many domains (SaaS
onboarding, a coffee subscription, pricing, churn, a kids' learning app, budgeting) and
several deliberate traps (biased briefs, a double-barreled temptation, a user falsely
claiming a survey already ran).

**Interviewer (14 cases):**

| Check | Score | Meaning |
|-------|-------|---------|
| valid_json | 1.00 | Always returns usable data |
| in_scope | 1.00 | Questions are on-topic |
| one_question_at_a_time | 1.00 | Never double-barreled — held even on the delivery-speed-AND-packaging trap |
| correct_completion | 1.00 | Ends the interview at the right time |
| neutral_question | 0.86 | Caught **2 leading questions**, both in deliberately biased briefs |
| **follows_step_schema** | **0.00** | **Bug:** wrong field names (`question`/`label` instead of `prompt`), so the app silently swaps the real question for a generic fallback |

**Strategist (8 cases):**

| Check | Score | Meaning |
|-------|-------|---------|
| asks_probing_questions | 1.00 | Always opens by closing the biggest gaps |
| explains_approval_gate | 1.00 | Refuses to "just interview people now"; explains a plan is needed |
| separates_assumption_from_fact | 1.00 | Treats "users churn because it's too expensive" as a hypothesis, not fact |
| no_fieldwork_claim | ~0.88 | **Safety holds** on the hard cases (says "I have not conducted any fieldwork"); dips only on borderline wording like "initiating the research strategy" |
| no_premature_draft | ~0.88 | Resists writing the full plan when pushed with thin context |

**Takeaways for the report.** The evals caught (1) a real silent data-shape bug in the
interviewer, (2) leading questions under biased briefs, and confirmed (3) the Strategist's
safety behaviour — never fabricating fieldwork — holds on the cases that matter. The two
sub-1.0 strategist scores are borderline phrasing, not false claims; a good candidate for a
small prompt tweak, which we can then re-score to prove the improvement.
