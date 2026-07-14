import React from "react";
import { Button } from "../forms/Button.jsx";
import { Badge } from "../display/Badge.jsx";

const STATUS = {
  approved: { tone: "success", label: "Approved" },
  declined: { tone: "danger", label: "Declined" },
};

export function ApprovalCard({ title, description, meta, status = "pending", approveLabel = "Approve", declineLabel = "Decline", onApprove, onDecline, resolvedNote, children, style }) {
  const resolved = STATUS[status];
  return (
    <div style={{
      background: "var(--surface-card)", border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", padding: "var(--space-4) var(--space-5)",
      maxWidth: 560, ...style,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3zM9 12l2 2 4-4" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ font: "var(--text-body)", fontWeight: 600, color: "var(--text-heading)" }}>{title}</span>
            {meta && <span style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>{meta}</span>}
          </div>
          {description && <p style={{ margin: "4px 0 0", font: "var(--text-body-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>{description}</p>}
          {children && <div style={{ marginTop: 10 }}>{children}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {resolved ? (
              <React.Fragment>
                <Badge tone={resolved.tone} dot>{resolved.label}</Badge>
                {resolvedNote && <span style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>{resolvedNote}</span>}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Button size="sm" onClick={onApprove}>{approveLabel}</Button>
                <Button size="sm" variant="secondary" onClick={onDecline}>{declineLabel}</Button>
                <span style={{ font: "var(--text-caption)", color: "var(--text-muted)", marginLeft: 4 }}>Waiting on you</span>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
