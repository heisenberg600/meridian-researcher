import React from "react";

const DEFAULT_MODELS = [
  { id: "meridian-pro", name: "Meridian Pro", desc: "Deep reasoning, long documents", tag: "Recommended" },
  { id: "meridian-core", name: "Meridian Core", desc: "Balanced speed and quality" },
  { id: "meridian-lite", name: "Meridian Lite", desc: "Fastest, for drafts and summaries" },
];

export function ModelPicker({ models = DEFAULT_MODELS, value, onChange, disabled = false, style }) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(null);
  const ref = React.useRef(null);
  const selected = models.find((m) => m.id === value) || models[0];
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", ...style }}>
      <button
        type="button" disabled={disabled} onClick={() => setOpen(!open)}
        onMouseEnter={() => setHover("trigger")} onMouseLeave={() => setHover(null)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px",
          border: "1px solid transparent", borderRadius: "var(--radius-md)", cursor: disabled ? "default" : "pointer",
          background: open || hover === "trigger" ? "var(--ivory-200)" : "transparent",
          color: "var(--text-secondary)", font: "var(--text-body-sm)", fontWeight: 500,
          transition: "background var(--duration-fast) var(--ease-out)", outline: "none",
        }}
      >
        {selected.name}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform var(--duration-fast) var(--ease-out)" }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="listbox" style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 50, width: 260,
          background: "var(--surface-overlay)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: 4,
        }}>
          {models.map((m) => {
            const active = m.id === selected.id;
            return (
              <button
                key={m.id} type="button" role="option" aria-selected={active}
                onClick={() => { onChange && onChange(m.id); setOpen(false); }}
                onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left",
                  padding: "8px 10px", border: "none", borderRadius: "var(--radius-md)", cursor: "pointer",
                  background: hover === m.id ? "var(--ivory-200)" : "transparent",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text-heading)" }}>{m.name}</span>
                    {m.tag && <span style={{ font: "var(--text-caption)", color: "var(--clay-800)", background: "var(--accent-soft)", borderRadius: "var(--radius-full)", padding: "1px 7px" }}>{m.tag}</span>}
                  </div>
                  <div style={{ font: "var(--text-caption)", color: "var(--text-muted)", marginTop: 2 }}>{m.desc}</div>
                </div>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 3, flexShrink: 0 }}>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
