import React from "react";

const KIND_GLYPHS = {
  file: "M14 3v5h5M6 3h8l5 5v13H6z",
  link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1.5-1.5",
  audio: "M12 3v12M12 15a3 3 0 1 1-3 3M8 8v5M16 6v9M20 10v4M4 10v4",
};

export function SourceChip({ name, meta, kind = "file", onRemove, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 9px",
        background: "var(--surface-card)", border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)", font: "var(--text-body-sm)", color: "var(--text-body)",
        maxWidth: 260, ...style,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d={KIND_GLYPHS[kind] || KIND_GLYPHS.file} />
      </svg>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{name}</span>
      {meta && <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{meta}</span>}
      {onRemove && (
        <button
          type="button" aria-label={"Remove " + name} onClick={onRemove}
          style={{
            appearance: "none", border: "none", background: "transparent", cursor: "pointer",
            padding: 0, marginLeft: 1, display: "inline-flex", color: hover ? "var(--text-body)" : "var(--text-muted)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </span>
  );
}
