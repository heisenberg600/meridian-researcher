Right-side document canvas that opens next to a chat thread — the user reads a PDF/questionnaire/sheet in place, copies contents, or selects text and gives feedback in the chat (no in-canvas editing, Codex-style).

```jsx
<div style={{ display: "flex", height: "100%" }}>
  <div style={{ flex: 1 }}>{/* chat thread */}</div>
  {open && (
    <CanvasPanel title="Onboarding questionnaire.pdf" meta="PDF · 6 pages"
      width="44%" onCopy={copyDoc} onClose={() => setOpen(false)}>
      <PdfPage number={1} of={6}>…</PdfPage>
    </CanvasPanel>
  )}
</div>
```

- Fill it with `PdfPage` (documents) or `SheetGrid` (spreadsheets).
- `kind="sheet"` swaps the header glyph; `footerHint={null}` hides the feedback hint.
