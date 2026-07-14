import React from "react";

function HeaderBtn({ label, onClick, children }) {
  const [hover, setHover] = React.useState(false);
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button" aria-label={label} title={label}
      onClick={() => { if (onClick) onClick(); if (label.toLowerCase().includes("copy")) { setDone(true); setTimeout(() => setDone(false), 1200); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px",
        border: "none", borderRadius: "var(--radius-md)", cursor: "pointer",
        background: hover ? "var(--ivory-200)" : "transparent", color: done ? "var(--status-success)" : "var(--text-secondary)",
        font: "var(--text-body-sm)", fontWeight: 500,
        transition: "background var(--duration-fast) var(--ease-out)", outline: "none", flexShrink: 0,
      }}
    >
      {children}
      {done ? "Copied" : null}
    </button>
  );
}

export function CanvasPanel({ title, meta, kind = "file", onCopy, onDownload, onClose, footerHint = "Select anything here, then give feedback in the chat.", toolbar = null, width, children, style }) {
  const KIND = {
    file: "M14 3v5h5M6 3h8l5 5v13H6z",
    sheet: "M4 4h16v16H4zM4 10h16M10 4v16",
  };
  return (
    <aside style={{
      display: "flex", flexDirection: "column", width, minWidth: 0, height: "100%", boxSizing: "border-box",
      background: "var(--surface-card)", borderLeft: "1px solid var(--border-default)", ...style,
    }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 10px 0 16px",
        borderBottom: "1px solid var(--border-default)", flexShrink: 0,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d={KIND[kind] || KIND.file} />
        </svg>
        <span style={{ font: "var(--text-body-sm)", fontWeight: 600, color: "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {meta && <span style={{ font: "var(--text-caption)", color: "var(--text-muted)", flexShrink: 0 }}>{meta}</span>}
        <span style={{ flex: 1 }}></span>
        {toolbar}
        {onCopy && (
          <HeaderBtn label="Copy contents" onClick={onCopy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M8 8h12v12H8zM4 16V4h12" /></svg>
          </HeaderBtn>
        )}
        {onDownload && (
          <HeaderBtn label="Download" onClick={onDownload}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" /></svg>
          </HeaderBtn>
        )}
        {onClose && (
          <HeaderBtn label="Close panel" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </HeaderBtn>
        )}
      </header>
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-sunken)", padding: "var(--space-5)" }}>
        {children}
      </div>
      {footerHint && (
        <footer style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
          borderTop: "1px solid var(--border-default)", flexShrink: 0,
          font: "var(--text-caption)", color: "var(--text-muted)",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {footerHint}
        </footer>
      )}
    </aside>
  );
}
