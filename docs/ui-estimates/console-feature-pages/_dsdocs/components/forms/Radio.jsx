import React from "react";

export function Radio({ label, checked = false, disabled = false, onChange, style }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer", font: "var(--text-body)", color: disabled ? "var(--ink-300)" : "var(--text-body)", ...style }}>
      <span
        role="radio" aria-checked={checked} tabIndex={disabled ? -1 : 0}
        onClick={(e) => !disabled && onChange && onChange(e)}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !disabled) { e.preventDefault(); onChange && onChange(e); } }}
        onFocus={(e) => { e.target.style.boxShadow = "var(--focus-ring)"; }}
        onBlur={(e) => { e.target.style.boxShadow = "none"; }}
        style={{
          width: 18, height: 18, borderRadius: "var(--radius-full)", flexShrink: 0, outline: "none",
          border: checked ? "5.5px solid var(--accent)" : "1px solid var(--border-strong)",
          background: "var(--surface-card)", boxSizing: "border-box",
          transition: "border var(--duration-fast) var(--ease-out)",
        }}
      ></span>
      {label}
    </label>
  );
}

export function RadioGroup({ options = [], value, onChange, direction = "column", style }) {
  return (
    <div role="radiogroup" style={{ display: "flex", flexDirection: direction, gap: direction === "column" ? 10 : 20, ...style }}>
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return <Radio key={opt.value} label={opt.label} checked={value === opt.value} onChange={() => onChange && onChange(opt.value)} />;
      })}
    </div>
  );
}
