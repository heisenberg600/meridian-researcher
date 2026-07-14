import React from "react";

export function Tooltip({ label, side = "top", style, children }) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top:    { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    left:   { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
    right:  { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
  }[side];
  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span role="tooltip" style={{
          position: "absolute", zIndex: 50, whiteSpace: "nowrap",
          background: "var(--surface-inverse)", color: "var(--text-inverse)",
          font: "var(--text-body-sm)", padding: "5px 9px", borderRadius: "var(--radius-sm)",
          boxShadow: "var(--shadow-md)", pointerEvents: "none", ...pos,
        }}>{label}</span>
      )}
    </span>
  );
}
