import React from "react";

export function Card({ title, action = null, padded = true, style, children }) {
  return (
    <section style={{
      background: "var(--surface-card)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)",
      padding: padded ? "var(--space-5)" : 0, ...style,
    }}>
      {(title || action) && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: padded ? "var(--space-4)" : 0, padding: padded ? 0 : "var(--space-5)" }}>
          <h3 style={{ margin: 0, font: "var(--text-heading-sm)", color: "var(--text-heading)" }}>{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
