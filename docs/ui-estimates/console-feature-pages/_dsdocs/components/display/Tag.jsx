import React from "react";

export function Tag({ onRemove, style, children }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 8px",
      borderRadius: "var(--radius-sm)", background: "var(--surface-card)",
      border: "1px solid var(--border-default)", color: "var(--text-secondary)",
      font: "var(--text-body-sm)", whiteSpace: "nowrap", ...style,
    }}>
      {children}
      {onRemove && (
        <button
          type="button" aria-label="Remove" onClick={onRemove}
          onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 16, height: 16, padding: 0, border: "none", borderRadius: 3, cursor: "pointer",
            background: hover ? "var(--ivory-300)" : "transparent", color: "var(--text-muted)",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      )}
    </span>
  );
}
