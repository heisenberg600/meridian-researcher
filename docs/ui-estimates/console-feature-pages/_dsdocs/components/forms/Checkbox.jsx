import React from "react";

export function Checkbox({ label, checked, defaultChecked = false, disabled = false, onChange, style }) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const isOn = checked !== undefined ? checked : internal;
  const toggle = (e) => { if (disabled) return; if (checked === undefined) setInternal(!isOn); onChange && onChange(!isOn, e); };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer", font: "var(--text-body)", color: disabled ? "var(--ink-300)" : "var(--text-body)", ...style }}>
      <span
        role="checkbox" aria-checked={isOn} tabIndex={disabled ? -1 : 0}
        onClick={toggle} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(e); } }}
        onFocus={(e) => { e.target.style.boxShadow = "var(--focus-ring)"; }}
        onBlur={(e) => { e.target.style.boxShadow = "none"; }}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, outline: "none",
          border: "1px solid " + (isOn ? "var(--accent)" : "var(--border-strong)"),
          background: isOn ? (disabled ? "var(--ink-300)" : "var(--accent)") : "var(--surface-card)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "background var(--duration-fast) var(--ease-out)",
        }}
      >
        {isOn && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      {label}
    </label>
  );
}
