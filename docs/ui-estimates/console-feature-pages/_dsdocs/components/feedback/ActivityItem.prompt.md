One row of the cross-project activity feed — tinted glyph by kind, unread dot, project pill, time, and an optional inline action button.

```jsx
<ActivityItem kind="input" unread title="Approval needed to send survey"
  detail="Outreach agent is waiting on you." project="Churn study" time="2m ago"
  action="Review" onAction={openThread} />
<ActivityItem kind="form" title="New questionnaire response"
  detail="Priya S. completed the onboarding questionnaire." project="Onboarding research" time="1h ago" />
```

- Kinds: `input` (needs you, amber), `research` (report ready, slate), `form` (response, green), `call` (clay), `system` (neutral).
- Stack directly (no dividers); rows tint on hover.
