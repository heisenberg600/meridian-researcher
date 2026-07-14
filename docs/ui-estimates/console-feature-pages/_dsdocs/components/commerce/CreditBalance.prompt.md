Credit balance block for billing pages — large serif figure, usage note, optional low-balance warning, and an Add credits button. Wrap in a Card.

```jsx
<Card>
  <CreditBalance balance={12480} usedThisMonth={3210}
    refreshNote="Auto-refills at 500 · Dodo Payments"
    onAdd={() => setAddOpen(true)} />
</Card>
```

- `low` turns the figure red and adds a "Running low" flag.
