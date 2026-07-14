import React from "react";

export function Input({ label, hint, error, disabled = false, style, id, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? "in-" + label.replace(/\W+/g, "-").toLowerCase() : undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && <label htmlFor={inputId} style={{ font: "var(--text-body-sm)", fontWeight: 500, color: "var(--text-body)" }}>{label}</label>}
      <input
        id={inputId} disabled={disabled}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          height: "var(--control-height)", padding: "0 12px", borderRadius: "var(--radius-sm)",
          font: "var(--text-body)", color: "var(--text-body)",
          background: disabled ? "var(--ivory-200)" : "var(--surface-card)",
          border: "1px solid " + (error ? "var(--status-danger)" : focus ? "var(--border-focus)" : "var(--border-default)"),
          boxShadow: focus ? "var(--focus-ring)" : "none",
          outline: "none", transition: "box-shadow var(--duration-fast) var(--ease-out)",
        }}
        {...rest}
      />
      {error ? <div style={{ font: "var(--text-body-sm)", color: "var(--status-danger)" }}>{error}</div>
             : hint ? <div style={{ font: "var(--text-body-sm)", color: "var(--text-muted)" }}>{hint}</div> : null}
    </div>
  );
}
