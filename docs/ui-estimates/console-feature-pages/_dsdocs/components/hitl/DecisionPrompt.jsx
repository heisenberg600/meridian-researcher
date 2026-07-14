import React from "react";
import { Button } from "../forms/Button.jsx";

export function DecisionPrompt({ question, options = [], multi = false, value, onChange, onSubmit, submitLabel = "Confirm", resolved = false, style }) {
  const selected = multi ? (value || []) : value;
  const isOn = (id) => (multi ? selected.includes(id) : selected === id);
  const toggle = (id) => {
    if (!onChange) return;
    if (multi) onChange(isOn(id) ? selected.filter((x) => x !== id) : [...selected, id]);
    else onChange(id);
  };
  return (
    <div style={{
      background: "var(--surface-card)", border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", padding: "var(--space-4) var(--space-5)",
      maxWidth: 560, ...style,
    }}>
      <div style={{ font: "var(--text-body)", fontWeight: 600, color: "var(--text-heading)" }}>{question}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {options.map((o) => {
          const opt = typeof o === "string" ? { id: o, label: o } : o;
          const on = isOn(opt.id);
          return (
            <OptionChip key={opt.id} on={on} disabled={resolved && !on} onClick={() => !resolved && toggle(opt.id)}>
              {opt.label}
            </OptionChip>
          );
        })}
      </div>
      {!resolved && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <Button size="sm" onClick={onSubmit} disabled={multi ? selected.length === 0 : !selected}>{submitLabel}</Button>
          <span style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>{multi ? "Pick any that apply" : "Pick one"}</span>
        </div>
      )}
    </div>
  );
}

function OptionChip({ on, disabled, onClick, children }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 14px",
        borderRadius: "var(--radius-full)", cursor: disabled ? "default" : "pointer",
        border: "1px solid " + (on ? "var(--accent)" : "var(--border-strong)"),
        background: on ? "var(--accent-softer)" : hover && !disabled ? "var(--ivory-200)" : "var(--surface-card)",
        color: disabled ? "var(--ink-300)" : on ? "var(--clay-800)" : "var(--text-body)",
        font: "var(--text-body-sm)", fontWeight: 500,
        transition: "background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)",
        outline: "none",
      }}
    >
      {on && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      )}
      {children}
    </button>
  );
}
