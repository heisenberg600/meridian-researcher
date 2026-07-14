import React from "react";
import { Button } from "../forms/Button.jsx";

const KIND_META = {
  input: { glyph: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zM9 12l2 2 4-4", color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
  research: { glyph: "M14 3v5h5M6 3h8l5 5v13H6zM9 13h6M9 17h6", color: "var(--status-info)", bg: "var(--status-info-bg)" },
  form: { glyph: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", color: "var(--status-success)", bg: "var(--status-success-bg)" },
  call: { glyph: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.6 2.81.72A2 2 0 0 1 22 16.92z", color: "var(--clay-800)", bg: "var(--accent-soft)" },
  system: { glyph: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3", color: "var(--text-secondary)", bg: "var(--ivory-200)" },
};

export function ActivityItem({ kind = "system", title, detail, project, time, unread = false, action, onAction, style }) {
  const [hover, setHover] = React.useState(false);
  const k = KIND_META[kind] || KIND_META.system;
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px",
        borderRadius: "var(--radius-md)", background: hover ? "var(--ivory-200)" : "transparent",
        transition: "background var(--duration-fast) var(--ease-out)", ...style,
      }}
    >
      <span style={{
        width: 32, height: 32, flexShrink: 0, borderRadius: "var(--radius-full)",
        background: k.bg, color: k.color, display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={k.glyph} /></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ font: "var(--text-body)", fontWeight: unread ? 600 : 500, color: "var(--text-heading)" }}>{title}</span>
          {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, position: "relative", top: -1 }}></span>}
          <span style={{ marginLeft: "auto", flexShrink: 0, font: "var(--text-caption)", color: "var(--text-muted)" }}>{time}</span>
        </div>
        {detail && <div style={{ marginTop: 2, font: "var(--text-body-sm)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{detail}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: action || project ? 8 : 0 }}>
          {project && (
            <span style={{
              font: "var(--text-caption)", fontWeight: 500, color: "var(--text-secondary)",
              border: "1px solid var(--border-default)", borderRadius: "var(--radius-full)", padding: "2px 9px",
            }}>{project}</span>
          )}
          {action && <Button size="sm" variant="secondary" onClick={onAction}>{action}</Button>}
        </div>
      </div>
    </div>
  );
}
