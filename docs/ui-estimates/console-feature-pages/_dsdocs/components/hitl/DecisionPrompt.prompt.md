Structured human-input prompt the agent posts mid-thread — a question with tappable option chips (single or multi select) and a Confirm button. For free-text answers the user just replies in the composer.

```jsx
const [seg, setSeg] = React.useState(null);
<DecisionPrompt
  question="Which customer segment should the questionnaire target?"
  options={["Enterprise", "Mid-market", "Startups"]}
  value={seg} onChange={setSeg} onSubmit={confirm} resolved={done}
/>
```

- `multi` for checkbox-style multi-select (value becomes `string[]`).
- Set `resolved` after submit — chips lock, unchosen ones dim.
