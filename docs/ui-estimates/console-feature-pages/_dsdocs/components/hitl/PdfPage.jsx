import React from "react";

export function PdfPage({ number, of, children, style }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto var(--space-5)" }}>
      <div style={{
        background: "#fff", border: "1px solid var(--border-default)", borderRadius: 4,
        boxShadow: "var(--shadow-sm)", padding: "48px 56px", minHeight: 480,
        font: "var(--text-body)", color: "var(--text-body)", lineHeight: 1.65, ...style,
      }}>
        {children}
      </div>
      {number && (
        <div style={{ textAlign: "center", marginTop: 8, font: "var(--text-caption)", color: "var(--text-muted)" }}>
          Page {number}{of ? " of " + of : ""}
        </div>
      )}
    </div>
  );
}
