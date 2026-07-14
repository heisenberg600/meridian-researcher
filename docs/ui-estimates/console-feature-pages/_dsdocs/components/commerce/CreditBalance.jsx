import React from "react";
import { Button } from "../forms/Button.jsx";

export function CreditBalance({ balance = 0, unit = "credits", usedThisMonth, refreshNote, low = false, onAdd, addLabel = "Add credits", style }) {
  const fmt = (n) => n.toLocaleString("en-US");
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, ...style }}>
      <div>
        <div style={{ font: "var(--text-overline)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>Balance</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span style={{ font: "500 2.25rem/1 var(--font-serif-display)", letterSpacing: "var(--tracking-display)", color: low ? "var(--status-danger)" : "var(--text-heading)", fontVariantNumeric: "tabular-nums" }}>{fmt(balance)}</span>
          <span style={{ font: "var(--text-body-sm)", color: "var(--text-muted)" }}>{unit}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, font: "var(--text-body-sm)", color: "var(--text-secondary)" }}>
          {usedThisMonth !== undefined && <span>{fmt(usedThisMonth)} used this month</span>}
          {low && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--status-danger)", fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
              Running low
            </span>
          )}
        </div>
        {refreshNote && <div style={{ marginTop: 4, font: "var(--text-caption)", color: "var(--text-muted)" }}>{refreshNote}</div>}
      </div>
      {onAdd && <Button onClick={onAdd}>{addLabel}</Button>}
    </div>
  );
}
