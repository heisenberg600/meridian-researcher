Dialog is a centered modal on a 40% ink scrim (no blur) — Escape and scrim-click close it.

```jsx
<Dialog open={open} onClose={close} title="Delete API key"
  footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button variant="danger">Delete key</Button></>}>
  Delete this API key? This can't be undone.
</Dialog>
```
