Compact, quiet model selector for chat composers and thread headers — trigger shows the current model name; menu opens upward with name, one-line description, and optional "Recommended" tag.

```jsx
const [model, setModel] = React.useState("meridian-pro");
<ModelPicker value={model} onChange={setModel} />
```

- Pass `models` (`{id, name, desc?, tag?}[]`) to override the default Meridian trio.
- Designed to sit in the ChatComposer toolbar (left side, next to attach).
