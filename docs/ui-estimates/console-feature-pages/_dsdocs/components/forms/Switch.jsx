import React from "react";

export function Switch({ label, checked, defaultChecked = false, disabled = false, onChange, style }) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const isOn = checked !== undefined ? checked : internal;
  const toggle = () => { if (disabled) return; if (checked === undefined) setInternal(!isOn); onChange && onChange(!isOn); };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer", font: "var(--text-body)", color: disabled ? "var(--ink-300)" : "var(--text-body)", ...style }}>
      <span
        role="switch" aria-checked={isOn} tabIndex={disabled ? -1 : 0}
        onClick={toggle} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } }}
        onFocus={(e) => { e.target.style.boxShadow = "var(--focus-ring)"; }}
        onBlur={(e) => { e.target.style.boxShadow = "none"; }}
        style={{
          width: 34, height: 20, borderRadius: "var(--radius-full)", flexShrink: 0, position: "relative", outline: "none",
          background: isOn ? (disabled ? "var(--ink-300)" : "var(--accent)") : "var(--sand-300)",
          transition: "background var(--duration-base) var(--ease-out)",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: isOn ? 16 : 2, width: 16, height: 16,
          borderRadius: "var(--radius-full)", background: "#fff", boxShadow: "var(--shadow-xs)",
          transition: "left var(--duration-base) var(--ease-out)",
        }}></span>
      </span>
      {label}
    </label>
  );
}
