import React from "react";

export function Dialog({ open = false, onClose, title, footer = null, width = 440, children }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(23, 22, 18, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} style={{
        width, maxWidth: "100%", background: "var(--surface-overlay)",
        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden",
      }}>
        {title && (
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-5) var(--space-5) 0" }}>
            <h2 style={{ margin: 0, font: "var(--text-display-md)", fontSize: "1.375rem", color: "var(--text-heading)" }}>{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose} style={{
              appearance: "none", border: "none", background: "transparent", cursor: "pointer",
              width: 28, height: 28, borderRadius: "var(--radius-sm)", color: "var(--text-muted)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </header>
        )}
        <div style={{ padding: "var(--space-4) var(--space-5)", font: "var(--text-body)", color: "var(--text-secondary)" }}>{children}</div>
        {footer && (
          <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0 var(--space-5) var(--space-5)" }}>{footer}</footer>
        )}
      </div>
    </div>
  );
}
