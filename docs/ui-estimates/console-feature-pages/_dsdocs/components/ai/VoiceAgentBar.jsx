import React from "react";

export function VoiceAgentBar({ status = "Listening", duration, muted = false, onMute, onEnd, style }) {
  const [hover, setHover] = React.useState(null);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, height: 52, padding: "0 8px 0 18px",
      background: "var(--surface-inverse)", color: "var(--text-inverse)",
      borderRadius: "var(--radius-full)", boxShadow: "var(--shadow-lg)", ...style,
    }}>
      <style>{"@keyframes mer-voice-bar{0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(1)}}"}</style>
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", gap: 3, height: 20 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{
            width: 3, height: 18, borderRadius: 2, background: muted ? "var(--ink-400)" : "var(--clay-600)",
            transformOrigin: "center",
            animation: muted ? "none" : "mer-voice-bar 1.1s var(--ease-out) " + i * 0.14 + "s infinite",
            transform: muted ? "scaleY(0.3)" : undefined,
          }}></span>
        ))}
      </span>
      <span style={{ font: "var(--text-body-sm)", fontWeight: 500 }}>{muted ? "Muted" : status}</span>
      {duration && <span style={{ font: "var(--text-caption)", fontFamily: "var(--font-mono)", color: "var(--ink-300)" }}>{duration}</span>}
      <span style={{ flex: 1 }}></span>
      <button
        type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={onMute}
        onMouseEnter={() => setHover("mute")} onMouseLeave={() => setHover(null)}
        style={{
          width: 36, height: 36, borderRadius: "var(--radius-full)", border: "1px solid var(--ink-700)",
          background: hover === "mute" ? "var(--ink-700)" : "transparent", color: "var(--text-inverse)",
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "background var(--duration-fast) var(--ease-out)", outline: "none",
        }}
      >
        {muted ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2l20 20M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8M19 10v2c0 .7-.1 1.4-.3 2M5 10v2a7 7 0 0 0 11 5.7M12 19v3" /></svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></svg>
        )}
      </button>
      <button
        type="button" aria-label="End conversation" onClick={onEnd}
        onMouseEnter={() => setHover("end")} onMouseLeave={() => setHover(null)}
        style={{
          height: 36, padding: "0 16px", borderRadius: "var(--radius-full)", border: "none",
          background: hover === "end" ? "#9A3327" : "var(--status-danger)", color: "#fff",
          font: "var(--text-body-sm)", fontWeight: 600, cursor: "pointer",
          transition: "background var(--duration-fast) var(--ease-out)", outline: "none",
        }}
      >
        End
      </button>
    </div>
  );
}
