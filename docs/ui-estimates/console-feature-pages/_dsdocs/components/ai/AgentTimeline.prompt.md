Live multi-agent orchestration view for a thread — a vertical timeline showing which agent is working (spinner + shimmering text, Claude-Code-style), handoffs between agents, "Needs you" waits, and queued steps.

```jsx
<AgentTimeline steps={[
  { agent: "Research agent", detail: "Read 12 survey responses", state: "done", time: "1m 40s" },
  { agent: "Analysis agent", detail: "Clustering themes across interviews…", state: "working", handoffFrom: "Research agent" },
  { agent: "Outreach agent", detail: "Waiting for approval to send follow-ups", state: "waiting" },
  { agent: "Report agent", state: "queued" },
]} />
```

- Post it in the thread as an assistant-side block; update `state` as the run progresses.
- `compact` for tighter embedding between messages.
