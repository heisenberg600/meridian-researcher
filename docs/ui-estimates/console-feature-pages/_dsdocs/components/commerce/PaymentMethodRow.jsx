import React from "react";
import { Badge } from "../display/Badge.jsx";

export function PaymentMethodRow({ brand, last4, expiry, isDefault = false, onRemove, onMakeDefault, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", ...style }}
    >
      <span style={{
        width: 42, height: 28, borderRadius: 4, border: "1px solid var(--border-default)",
        background: "var(--ivory-200)", display: "inline-flex", alignItems: "center", justifyContent: "center",
        font: "600 0.5625rem/1 var(--font-mono)", letterSpacing: "0.04em", textTransform: "uppercase",
        color: "var(--text-secondary)", flexShrink: 0,
      }}>{brand}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "var(--text-body)", fontWeight: 500, color: "var(--text-heading)", fontVariantNumeric: "tabular-nums" }}>•••• {last4}</span>
          {isDefault && <Badge tone="neutral">Default</Badge>}
        </div>
        {expiry && <div style={{ font: "var(--text-caption)", color: "var(--text-muted)", marginTop: 2 }}>Expires {expiry}</div>}
      </div>
      <div style={{ display: "flex", gap: 4, opacity: hover ? 1 : 0, transition: "opacity var(--duration-fast) var(--ease-out)" }}>
        {!isDefault && onMakeDefault && <TextAction onClick={onMakeDefault}>Make default</TextAction>}
        {onRemove && <TextAction danger onClick={onRemove}>Remove</TextAction>}
      </div>
    </div>
  );
}

function TextAction({ danger = false, onClick, children }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        appearance: "none", border: "none", background: hover ? "var(--ivory-200)" : "transparent",
        borderRadius: "var(--radius-sm)", padding: "5px 9px", cursor: "pointer",
        font: "var(--text-body-sm)", fontWeight: 500,
        color: danger ? "var(--status-danger)" : "var(--text-secondary)",
        transition: "background var(--duration-fast) var(--ease-out)", outline: "none",
      }}
    >{children}</button>
  );
}
