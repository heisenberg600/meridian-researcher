import React from "react";
import { SourceChip } from "./SourceChip.jsx";

function ToolBtn({ label, active = false, accent = false, onClick, children }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button" aria-label={label} title={label} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: "none", borderRadius: accent ? "var(--radius-full)" : "var(--radius-md)", cursor: "pointer",
        background: accent ? (hover ? "var(--accent-hover)" : "var(--accent)") : active || hover ? "var(--ivory-200)" : "transparent",
        color: accent ? "#fff" : active ? "var(--accent)" : "var(--text-muted)",
        transition: "background var(--duration-fast) var(--ease-out)", outline: "none", flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export function ChatComposer({ placeholder = "Message Meridian…", attachments = [], onSend, onAttach, onVoice, voiceActive = false, toolbar = null, style }) {
  const [text, setText] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const send = () => { if (text.trim() && onSend) { onSend(text.trim()); setText(""); } };
  return (
    <div style={{
      background: "var(--surface-card)", border: "1px solid " + (focus ? "var(--border-focus)" : "var(--border-default)"),
      borderRadius: "var(--radius-xl)", boxShadow: focus ? "var(--focus-ring)" : "var(--shadow-xs)",
      transition: "box-shadow var(--duration-fast) var(--ease-out)", padding: "12px 14px 10px", ...style,
    }}>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {attachments.map((a, i) => <SourceChip key={i} {...a} />)}
        </div>
      )}
      <textarea
        rows={1} value={text} placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        style={{
          display: "block", width: "100%", minHeight: 24, maxHeight: 160, resize: "none",
          border: "none", outline: "none", background: "transparent", padding: 0,
          font: "var(--text-body)", color: "var(--text-body)", boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
        <ToolBtn label="Attach document" onClick={onAttach}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </ToolBtn>
        {toolbar}
        <span style={{ flex: 1 }}></span>
        <ToolBtn label={voiceActive ? "Stop voice" : "Talk to agent"} active={voiceActive} onClick={onVoice}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></svg>
        </ToolBtn>
        <ToolBtn label="Send" accent onClick={send}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7M12 19V5" /></svg>
        </ToolBtn>
      </div>
    </div>
  );
}
