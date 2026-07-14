One rendered PDF page inside a CanvasPanel — a white sheet with document margins on the sunken background, page number caption below. Stack several for multi-page docs.

```jsx
<PdfPage number={1} of={6}>
  <h2 style={{ font: "var(--text-display-md)" }}>Customer onboarding questionnaire</h2>
  <p>1. What does your team spend the most time on each week?</p>
</PdfPage>
```
