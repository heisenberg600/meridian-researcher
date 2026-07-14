One message in an agent conversation — user messages are right-aligned ivory bubbles, assistant messages full-width prose with a serif monogram marker.

```jsx
<ChatMessage role="user">Summarize the Q2 churn report.</ChatMessage>
<ChatMessage role="assistant" author="Meridian" time="2:41 PM"
  sources={[{ name: "q2-churn.pdf", meta: "PDF" }]}>
  Churn fell 1.2 points quarter-over-quarter…
</ChatMessage>
```

- Stack messages in a flex column with `gap: 24px`.
- `sources` renders read-only SourceChips as citations.
