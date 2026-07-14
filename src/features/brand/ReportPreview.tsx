import type { CSSProperties } from "react";

import type { BrandProfile } from "../context/contracts";

export function ReportPreview({ profile }: { profile: BrandProfile }) {
  const style = {
    "--brand-primary": profile.primaryColor,
    "--brand-accent": profile.accentColor,
    "--brand-heading": profile.headingFont === "serif" ? "var(--font-serif-display)" : "var(--font-sans)",
    "--brand-body": profile.bodyFont === "serif" ? "var(--font-serif-display)" : "var(--font-sans)",
  } as CSSProperties;

  return (
    <figure
      aria-labelledby="brand-preview-title"
      style={style}
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-md)]"
    >
      <figcaption className="sr-only">Live report preview using the current brand profile.</figcaption>
      <div className="h-1.5 bg-[var(--brand-accent)]" />
      <div className="aspect-[4/5] min-h-[430px] p-6 sm:p-8">
        <header className="flex min-h-10 items-start justify-between gap-4 border-b border-[color:color-mix(in_srgb,var(--brand-primary)_18%,white)] pb-5">
          <BrandMark profile={profile} />
          <p className="text-right [font:var(--text-caption)] uppercase tracking-[0.14em] text-[var(--brand-primary)]">Research report</p>
        </header>

        <div className="pt-10">
          <p className="[font:var(--text-caption)] uppercase tracking-[0.16em] text-[var(--brand-accent)]">Customer evidence · July 2026</p>
          <h2
            id="brand-preview-title"
            className="mt-4 max-w-md text-[clamp(2rem,7vw,3.5rem)] leading-[0.98] tracking-[-0.04em] text-[var(--brand-primary)] [font-family:var(--brand-heading)]"
          >
            {profile.reportTitle}
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[color:color-mix(in_srgb,var(--brand-primary)_72%,white)] [font-family:var(--brand-body)]">
            A concise synthesis of the patterns customers repeated, the tensions behind them, and the decisions they support.
          </p>
        </div>

        <div aria-hidden="true" className="mt-10 grid grid-cols-[1.5fr_0.8fr] gap-3">
          <div className="h-24 rounded-sm bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] p-4">
            <div className="h-2 w-20 rounded-full bg-[var(--brand-accent)]" />
            <div className="mt-4 h-1.5 w-full rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_24%,white)]" />
            <div className="mt-2 h-1.5 w-4/5 rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)]" />
          </div>
          <div className="rounded-sm bg-[var(--brand-primary)] p-4">
            <div className="h-8 w-8 rounded-full border-2 border-[var(--brand-accent)]" />
            <div className="mt-4 h-1.5 w-full rounded-full bg-white/45" />
          </div>
        </div>

        <footer className="mt-10 flex items-end justify-between gap-4 border-t border-[color:color-mix(in_srgb,var(--brand-primary)_18%,white)] pt-4">
          <p className="text-xs text-[var(--brand-primary)] [font-family:var(--brand-body)]">{profile.reportFooter}</p>
          <span className="text-xs tabular-nums text-[var(--brand-primary)]">01</span>
        </footer>
      </div>
    </figure>
  );
}

function BrandMark({ profile }: { profile: BrandProfile }) {
  if (profile.logoUrl) {
    return <img src={profile.logoUrl} alt={`${profile.displayName} logo`} className="max-h-10 max-w-36 object-contain object-left" />;
  }

  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="size-5 rotate-45 rounded-[3px] bg-[var(--brand-accent)]" />
      <span className="text-base font-semibold tracking-[-0.02em] text-[var(--brand-primary)] [font-family:var(--brand-heading)]">{profile.displayName}</span>
    </div>
  );
}
