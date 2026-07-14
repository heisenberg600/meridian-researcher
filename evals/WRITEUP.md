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

## First run results (live against Laminar)

**Strategist — 4/4 passed.** Asks good probing questions, never claims fieldwork happened,
doesn't over-draft, and correctly explains that outreach needs approval. The safety-critical
behaviour holds.

**Interviewer — mostly good, one real bug caught:**

| Check | Score | Meaning |
|-------|-------|---------|
| valid_json | 1.0 | Always returns usable data |
| in_scope | 1.0 | Questions are on-topic |
| correct_completion | 1.0 | Ends the interview at the right time |
| neutral_question | 0.75 | Caught **one leading question** — in the deliberately biased-brief case |
| **follows_step_schema** | **0.0** | **Bug:** output uses the wrong field names (`question`/`label` instead of `prompt`), so the app silently swaps the real question for a generic fallback |

The eval did exactly its job on day one: it caught a leading question *and* a silent
data-shape bug that would have quietly degraded live interviews. Both are now tracked and
will be re-scored on every change.
