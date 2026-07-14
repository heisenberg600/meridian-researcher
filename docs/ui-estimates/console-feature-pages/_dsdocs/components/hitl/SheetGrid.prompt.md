Spreadsheet view for a CanvasPanel — Excel-style column letters, row numbers, bold header row, optional cell selection (click a cell, then reference it in chat feedback).

```jsx
<SheetGrid
  columns={["Question", "Type", "Required"]}
  rows={[["What does your team spend time on?", "Long text", "Yes"]]}
  selected={sel} onSelect={setSel}
/>
```
