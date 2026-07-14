import React from "react";
import { SourceChip } from "./SourceChip.jsx";

export function ChatMessage({ role = "assistant", author, time, sources = [], children, style }) {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", ...style }}>
        <div style={{
          maxWidth: "72%", background: "var(--ivory-200)", borderRadius: "var(--radius-lg)",
          padding: "10px 14px", font: "var(--text-body)", color: "var(--text-body)",
        }}>
          {children}
          {sources.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {sources.map((s, i) => <SourceChip key={i} {...s} />)}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 12, ...style }}>
      <span style={{
        width: 26, height: 26, flexShrink: 0, borderRadius: "var(--radius-full)",
        background: "var(--accent-soft)", color: "var(--clay-800)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        font: "500 0.8125rem/1 var(--font-serif-display)", marginTop: 1,
      }}>{(author || "M")[0]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {(author || time) && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            {author && <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text-heading)" }}>{author}</span>}
            {time && <span style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>{time}</span>}
          </div>
        )}
        <div style={{ font: "var(--text-body)", color: "var(--text-body)", lineHeight: 1.6 }}>{children}</div>
        {sources.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {sources.map((s, i) => <SourceChip key={i} {...s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
