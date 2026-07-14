import React from "react";

export function Tabs({ items = [], value, onChange, style }) {
  const [hovered, setHovered] = React.useState(null);
  return (
    <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border-default)", ...style }}>
      {items.map((item) => {
        const it = typeof item === "string" ? { id: item, label: item } : item;
        const active = value === it.id;
        return (
          <button
            key={it.id} role="tab" aria-selected={active} type="button"
            onClick={() => onChange && onChange(it.id)}
            onMouseEnter={() => setHovered(it.id)} onMouseLeave={() => setHovered(null)}
            style={{
              appearance: "none", background: "transparent", border: "none", cursor: "pointer",
              padding: "10px 12px", marginBottom: -1, font: "var(--text-label)",
              color: active ? "var(--text-heading)" : hovered === it.id ? "var(--text-body)" : "var(--text-secondary)",
              borderBottom: "2px solid " + (active ? "var(--accent)" : "transparent"),
              transition: "color var(--duration-fast) var(--ease-out)", outline: "none",
            }}
          >
            {it.label}
            {it.count !== undefined && (
              <span style={{ marginLeft: 6, font: "var(--text-body-sm)", color: "var(--text-muted)" }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
