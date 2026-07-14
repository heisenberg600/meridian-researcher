Radio / RadioGroup for single-choice sets; prefer RadioGroup so selection logic is handled for you.

```jsx
<RadioGroup options={["Monthly", "Annual"]} value={plan} onChange={setPlan} />
```

direction="row" for short inline sets.
