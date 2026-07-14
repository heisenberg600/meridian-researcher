import React from "react";

const SHIMMER = "@keyframes mer-agent-shimmer{0%{opacity:.45}50%{opacity:1}100%{opacity:.45}}";

function StateDot({ state }) {
  if (state === "working") {
    return (
      <span style={{ position: "relative", width: 14, height: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <style>{"@keyframes mer-agent-spin{to{transform:rotate(360deg)}}"}</style>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "mer-agent-spin 0.9s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.2-8.56" />
        </svg>
      </span>
    );
  }
  const styles = {
    done: { background: "var(--status-success)", border: "none" },
    waiting: { background: "var(--status-warning)", border: "none" },
    queued: { background: "transparent", border: "1.5px solid var(--sand-400)" },
  }[state] || {};
  return (
    <span style={{ width: 14, height: 14, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {state === "done" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      ) : (
        <span style={{ width: 8, height: 8, borderRadius: "50%", boxSizing: "border-box", ...styles }}></span>
      )}
    </span>
  );
}

export function AgentTimeline({ steps = [], compact = false, style }) {
  return (
    <div style={{
      background: "var(--surface-card)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: compact ? "10px 14px" : "var(--space-4) var(--space-5)",
      maxWidth: 560, ...style,
    }}>
      <style>{SHIMMER}</style>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14 }}>
                <div style={{ paddingTop: 4 }}><StateDot state={s.state || "queued"} /></div>
                {!last && <div style={{ width: 1, flex: 1, background: "var(--border-default)", margin: "4px 0" }}></div>}
              </div>
              <div style={{ paddingBottom: last ? 0 : compact ? 10 : 16, minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    font: "var(--text-body-sm)", fontWeight: 600,
                    color: s.state === "queued" ? "var(--text-muted)" : "var(--text-heading)",
                    animation: s.state === "working" ? "mer-agent-shimmer 1.6s var(--ease-out) infinite" : "none",
                  }}>{s.agent}</span>
                  {s.handoffFrom && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, font: "var(--text-caption)", color: "var(--text-muted)" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
                      from {s.handoffFrom}
                    </span>
                  )}
                  {s.state === "waiting" && <span style={{ font: "var(--text-caption)", fontWeight: 600, color: "var(--status-warning)" }}>Needs you</span>}
                  {s.time && <span style={{ font: "var(--text-caption)", color: "var(--text-muted)", marginLeft: "auto" }}>{s.time}</span>}
                </div>
                {s.detail && (
                  <div style={{
                    marginTop: 2, font: "var(--text-body-sm)", color: "var(--text-secondary)", lineHeight: 1.5,
                    animation: s.state === "working" ? "mer-agent-shimmer 1.6s var(--ease-out) infinite" : "none",
                  }}>{s.detail}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
