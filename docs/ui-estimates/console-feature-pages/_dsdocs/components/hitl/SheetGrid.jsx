import React from "react";

export function SheetGrid({ columns = [], rows = [], selected = null, onSelect, style }) {
  const colLetter = (i) => String.fromCharCode(65 + i);
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--border-default)", borderRadius: 4,
      boxShadow: "var(--shadow-sm)", overflow: "auto", ...style,
    }}>
      <table style={{ borderCollapse: "collapse", width: "100%", font: "var(--text-body-sm)", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr>
            <th style={cornerCell}></th>
            {columns.map((c, i) => <th key={i} style={letterCell}>{colLetter(i)}</th>)}
          </tr>
          <tr>
            <th style={numCell}>1</th>
            {columns.map((c, i) => <th key={i} style={headCell}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th style={numCell}>{r + 2}</th>
              {row.map((cell, c) => {
                const isSel = selected && selected[0] === r && selected[1] === c;
                return (
                  <td
                    key={c} onClick={() => onSelect && onSelect([r, c])}
                    style={{
                      ...bodyCell,
                      cursor: onSelect ? "cell" : undefined,
                      background: isSel ? "var(--accent-softer)" : undefined,
                      boxShadow: isSel ? "inset 0 0 0 1.5px var(--accent)" : undefined,
                    }}
                  >{cell}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cornerCell = { width: 34, background: "var(--ivory-200)", border: "1px solid var(--border-default)", padding: "4px 6px" };
const letterCell = { background: "var(--ivory-200)", border: "1px solid var(--border-default)", padding: "4px 6px", font: "var(--text-caption)", fontWeight: 500, color: "var(--text-muted)", textAlign: "center" };
const numCell = { background: "var(--ivory-200)", border: "1px solid var(--border-default)", padding: "4px 6px", font: "var(--text-caption)", fontWeight: 500, color: "var(--text-muted)", textAlign: "center", width: 34 };
const headCell = { border: "1px solid var(--border-default)", padding: "6px 10px", fontWeight: 600, color: "var(--text-heading)", textAlign: "left", background: "#fff", whiteSpace: "nowrap" };
const bodyCell = { border: "1px solid var(--border-default)", padding: "6px 10px", color: "var(--text-body)", whiteSpace: "nowrap" };
