import React from "react";

const toastTones = {
  neutral: "var(--ink-900)",
  success: "var(--status-success)",
  danger: "var(--status-danger)",
};

export function Toast({ tone = "neutral", action = null, style, children }) {
  return (
    <div role="status" style={{
      display: "inline-flex", alignItems: "center", gap: 12, minHeight: 44,
      padding: "10px 16px", borderRadius: "var(--radius-md)",
      background: "var(--surface-inverse)", color: "var(--text-inverse)",
      boxShadow: "var(--shadow-lg)", font: "var(--text-body)", ...style,
    }}>
      {tone !== "neutral" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: toastTones[tone], flexShrink: 0, filter: "brightness(1.6)" }}></span>}
      <span>{children}</span>
      {action}
    </div>
  );
}
