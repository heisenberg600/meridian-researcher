Human-in-the-loop checkpoint card the agent posts in a thread when it needs sign-off before acting. Pending → Approve/Decline buttons; resolved → status badge.

```jsx
<ApprovalCard
  title="Send survey to 214 customers"
  meta="Outreach agent"
  description="Email draft attached. Sends immediately on approval."
  status={status} onApprove={() => setStatus("approved")} onDecline={() => setStatus("declined")}
  resolvedNote="by Dana · 2:41 PM"
/>
```

- Put detail payloads (chips, summary rows) in `children`.
- Rename actions via `approveLabel` / `declineLabel` ("Send it", "Hold").
