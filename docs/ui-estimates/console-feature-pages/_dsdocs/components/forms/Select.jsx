import React from "react";

export function Select({ label, options = [], disabled = false, style, id, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const selectId = id || (label ? "sel-" + label.replace(/\W+/g, "-").toLowerCase() : undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && <label htmlFor={selectId} style={{ font: "var(--text-body-sm)", fontWeight: 500, color: "var(--text-body)" }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select
          id={selectId} disabled={disabled}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            width: "100%", height: "var(--control-height)", padding: "0 32px 0 12px",
            borderRadius: "var(--radius-sm)", font: "var(--text-body)", color: "var(--text-body)",
            background: disabled ? "var(--ivory-200)" : "var(--surface-card)",
            border: "1px solid " + (focus ? "var(--border-focus)" : "var(--border-default)"),
            boxShadow: focus ? "var(--focus-ring)" : "none",
            outline: "none", appearance: "none", WebkitAppearance: "none", cursor: "pointer",
          }}
          {...rest}
        >
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)" }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
