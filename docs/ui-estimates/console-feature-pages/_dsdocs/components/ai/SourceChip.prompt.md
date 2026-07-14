Small bordered chip for an attached document, link, or audio source — used for composer attachments, message citations, and knowledge rows.

```jsx
<SourceChip name="Q2 pricing.pdf" meta="PDF · 2.4 MB" onRemove={() => remove(id)} />
<SourceChip name="notion.so/roadmap" kind="link" />
```

- `kind`: `file` (default), `link`, `audio` — changes the glyph.
- Omit `onRemove` for read-only citation chips.
