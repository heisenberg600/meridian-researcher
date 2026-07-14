import React from "react";

const tones = {
  neutral: { bg: "var(--ivory-200)", fg: "var(--text-secondary)" },
  accent:  { bg: "var(--accent-soft)", fg: "var(--clay-800)" },
  success: { bg: "var(--status-success-bg)", fg: "var(--status-success)" },
  warning: { bg: "var(--status-warning-bg)", fg: "var(--status-warning)" },
  danger:  { bg: "var(--status-danger-bg)", fg: "var(--status-danger)" },
  info:    { bg: "var(--status-info-bg)", fg: "var(--status-info)" },
};

export function Badge({ tone = "neutral", dot = false, style, children }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 22, padding: "0 10px",
      borderRadius: "var(--radius-full)", background: t.bg, color: t.fg,
      font: "var(--text-body-sm)", fontWeight: 500, whiteSpace: "nowrap", ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }}></span>}
      {children}
    </span>
  );
}
