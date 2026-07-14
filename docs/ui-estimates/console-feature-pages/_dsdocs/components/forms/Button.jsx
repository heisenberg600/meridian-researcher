import React from "react";

const heights = { sm: "var(--control-height-sm)", md: "var(--control-height)", lg: "var(--control-height-lg)" };
const pads = { sm: "0 10px", md: "0 16px", lg: "0 20px" };

export function Button({ variant = "primary", size = "md", disabled = false, iconLeft = null, style, children, ...rest }) {
  const [state, setState] = React.useState("idle");
  const v = {
    primary: {
      idle: { background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
      hover: { background: "var(--accent-hover)" },
      active: { background: "var(--accent-active)" },
    },
    secondary: {
      idle: { background: "var(--surface-card)", color: "var(--text-body)", border: "1px solid var(--border-strong)" },
      hover: { background: "var(--ivory-200)" },
      active: { background: "var(--ivory-300)" },
    },
    ghost: {
      idle: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
      hover: { background: "var(--ivory-200)", color: "var(--text-body)" },
      active: { background: "var(--ivory-300)" },
    },
    danger: {
      idle: { background: "var(--status-danger)", color: "#fff", border: "1px solid transparent" },
      hover: { background: "#9A3327" },
      active: { background: "#822B21" },
    },
  }[variant];
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    height: heights[size], padding: pads[size], borderRadius: "var(--radius-md)",
    font: "var(--text-label)", fontSize: size === "sm" ? "0.8125rem" : undefined,
    cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
    transition: "background var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)",
    outline: "none",
    ...v.idle,
    ...(!disabled && state !== "idle" ? v[state] : {}),
    ...(disabled ? { background: "var(--ivory-200)", color: "var(--ink-300)", border: "1px solid transparent" } : {}),
    ...style,
  };
  return (
    <button
      type="button" disabled={disabled} style={base}
      onMouseEnter={() => setState("hover")} onMouseLeave={() => setState("idle")}
      onMouseDown={() => setState("active")} onMouseUp={() => setState("hover")}
      onFocus={(e) => { e.target.style.boxShadow = "var(--focus-ring)"; }}
      onBlur={(e) => { e.target.style.boxShadow = "none"; }}
      {...rest}
    >
      {iconLeft}
      {children}
    </button>
  );
}
