Floating ink-black pill shown while a voice conversation is live — animated clay level bars, status text ("Listening" / "Speaking"), elapsed time, mute + End controls.

```jsx
{voice && (
  <VoiceAgentBar status="Listening" duration="02:14"
    muted={muted} onMute={() => setMuted(!muted)} onEnd={() => setVoice(false)} />
)}
```

- Place it floating above the composer (absolute, centered) or docked in the thread header.
- The only always-animated element in the system; bars freeze when `muted`.
