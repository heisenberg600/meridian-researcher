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
