Button is the standard Meridian action control — use "primary" for the single main verb of a view, "secondary" beside it, "ghost" for quiet/inline actions, "danger" for destructive ones.

```jsx
<Button onClick={save}>Export report</Button>
<Button variant="secondary">Cancel</Button>
```

Labels are sentence-case, verb-first ("Invite members"). Sizes sm/md/lg (28/36/44px). Pass a 16px SVG via iconLeft.
