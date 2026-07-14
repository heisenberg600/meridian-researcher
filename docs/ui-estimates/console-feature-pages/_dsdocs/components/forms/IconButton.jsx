import React from "react";

export function IconButton({ variant = "ghost", size = "md", disabled = false, "aria-label": ariaLabel, style, children, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const dims = { sm: 28, md: 36, lg: 44 }[size];
  const styles = {
    ghost: { background: hover && !disabled ? "var(--ivory-200)" : "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
    secondary: { background: hover && !disabled ? "var(--ivory-200)" : "var(--surface-card)", color: "var(--text-body)", border: "1px solid var(--border-strong)" },
  }[variant];
  return (
    <button
      type="button" aria-label={ariaLabel} title={ariaLabel} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={(e) => { e.target.style.boxShadow = "var(--focus-ring)"; }}
      onBlur={(e) => { e.target.style.boxShadow = "none"; }}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: dims, height: dims, borderRadius: "var(--radius-md)", cursor: disabled ? "default" : "pointer",
        transition: "background var(--duration-fast) var(--ease-out)", outline: "none",
        ...styles, ...(disabled ? { color: "var(--ink-300)" } : {}), ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
