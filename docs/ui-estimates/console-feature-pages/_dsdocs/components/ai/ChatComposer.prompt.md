Chat input card: auto-growing textarea, attach + voice + send buttons, and a `toolbar` slot for a ModelPicker. Enter sends, Shift+Enter for newline.

```jsx
<ChatComposer
  attachments={[{ name: "brief.docx", meta: "DOCX", onRemove: () => {} }]}
  toolbar={<ModelPicker value={model} onChange={setModel} />}
  onSend={(text) => addMessage(text)}
  onAttach={openFilePicker}
  onVoice={() => setVoice(true)} voiceActive={voice}
/>
```

- Pin to the bottom of the thread; thread column max-width ~760px.
