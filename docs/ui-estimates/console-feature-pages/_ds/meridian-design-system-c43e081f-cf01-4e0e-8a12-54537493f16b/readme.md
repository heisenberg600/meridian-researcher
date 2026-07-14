# Meridian Design System

Sleek, minimal, modern design system for **Meridian** — an invented B2B brand created for workathon/build-a-thon prototyping. The user provided no product or codebase; the visual direction was requested as "sleek, minimal, very modern, for B2B customers," referencing https://www.anthropic.com as an aesthetic inspiration.

**Important:** This is an *original* system in the warm-minimalist genre (ivory paper backgrounds, serif display type, restrained terracotta accent). It deliberately does **not** reproduce any company's logo, name, proprietary fonts, exact palette, or copy. There is **no logo asset** — render the wordmark "Meridian" in plain display serif wherever a mark would go.

## Sources
- User brief (chat): sleek/minimal/modern, B2B audience, workathon context.
- Aesthetic reference: https://www.anthropic.com (vibe only; nothing copied).
- No Figma, codebase, decks, or font files were provided.

## Products represented
One notional surface, invented for prototyping:
- **Meridian Console** — a B2B research-agent platform (projects → chats/sub-chats with multi-agent orchestration, global knowledge, credits/billing via Dodo Payments, appointments, custom branding). See `ui_kits/console/`.

### Product concepts the system covers
- **Projects** hold files and chats; chats can have sub-chats.
- **Agent chat** with model picker, document attach, citation chips, and a right-side **canvas** for reading PDFs/sheets (copy + give feedback in chat; no in-canvas editing).
- **Multi-agent orchestration** surfaced via AgentTimeline: working (spinner + shimmer), handoffs, "Needs you" waits, queued.
- **Human in the loop**: ApprovalCard (sign-off before the agent acts) and DecisionPrompt (structured choices).
- **Voice agent** conversations via VoiceAgentBar (the system's only always-animated element).
- **Activity feed** across projects: what needs you, new responses, calls picked up, research ready.
- **Credits & billing**: CreditBalance + PaymentMethodRow; payment processing is Dodo Payments (text-plate brands, no card logos).
- **Custom branding**: consoles can be re-skinned per customer — accent tokens and the wordmark are override points (see BrandingScreen; it sets `--accent*` custom properties live).

---

## CONTENT FUNDAMENTALS

- **Tone:** calm, precise, confident. Plain declarative sentences. No hype, no exclamation points, no filler adverbs ("incredibly", "seamlessly").
- **Casing:** sentence case everywhere — headings, buttons, labels, nav ("Create workspace", not "Create Workspace"). Uppercase only for tiny overline labels (11px, tracked).
- **Person:** address the reader as "you"; the product speaks as "we" sparingly, mostly not at all. Prefer verb-first UI copy ("Invite members", "Export report").
- **Numbers & data:** exact figures, tabular numerals in tables, ISO-ish dates ("Jun 12, 2026").
- **Emoji:** never.
- **Microcopy examples:**
  - Empty state: "No reports yet. Create your first report to see usage across workspaces."
  - Destructive confirm: "Delete this API key? This can't be undone."
  - Success toast: "Changes saved"
  - Button pairs: primary verb + quiet "Cancel".
- **Vibe:** an intelligent tool that stays out of your way. Editorial, not "startup-y".

## VISUAL FOUNDATIONS

- **Color:** warm ivory page (`--bg-page` #FAF9F6), white cards, warm near-black ink (#171612). One accent: terracotta clay (#C2593B) used sparingly — primary buttons, links, focus, active states. Slate blue for info; muted green/amber/red for status. Large surfaces stay neutral; color is a signal, never decoration.
- **Type:** serif display (Source Serif 4, medium weight, tracking −0.015em) for heroes/page titles/section heads; grotesque sans (Instrument Sans) for everything functional; IBM Plex Mono for code, IDs, keys. Scale in `tokens/typography.css`. Body 15px.
- **Spacing:** 4px scale (`--space-*`). Generous whitespace: pages breathe with 32–80px section gaps; controls are compact (36px default height).
- **Backgrounds:** flat ivory. No gradients, no textures, no patterns, no hero imagery by default. Contrast comes from white cards on ivory, or the inverse ink-900 panel for occasional emphasis blocks.
- **Cards:** white, 12px radius, 1px `--border-default` border, `--shadow-xs`. Elevation stays subtle; `--shadow-lg` reserved for dialogs/popovers.
- **Borders:** hairline 1px, warm gray (#E5E2D9). Dividers over boxes wherever possible.
- **Shadows:** warm-tinted rgba(23,22,18,…), very low opacity. No inner shadows.
- **Radii:** 6px inputs/tags, 8px buttons, 12px cards, 16px feature panels, pill for badges/toggles.
- **Animation:** understated — 120–280ms fades and 2–4px translates with `--ease-out`. No bounces, no springs, no infinite loops.
- **Hover:** darken (accent → `--accent-hover`) or tint background (`--ivory-200` on quiet controls). Links underline on hover. **Press:** one step darker (`--accent-active`); no shrink transforms.
- **Focus:** 3px soft clay ring (`--focus-ring`), always visible for keyboard.
- **Transparency/blur:** essentially none; overlay scrim is rgba(23,22,18,0.4), no backdrop blur.
- **Imagery:** if photography is added, keep it warm, natural light, slightly desaturated. No stock-blue tech imagery. (None shipped.)
- **Layout:** 1200px max container for marketing-ish pages; app shell = fixed 240px sidebar + fluid content with 32px padding.

## ICONOGRAPHY

- **System:** [Lucide](https://lucide.dev) via CDN (`lucide@latest` UMD script or copied SVGs), 1.5px stroke, 16–20px sizes, `currentColor`. This is a **substitution** — no icon assets were provided; Lucide's thin-stroke minimalism matches the system. Flagged for replacement if the user supplies real icons.
- No icon font, no PNG icons, no emoji, no unicode-as-icons.
- Icons are always paired with text in navigation; icon-only buttons require a tooltip.
- **Logo:** none provided, none created. Wordmark = "Meridian" set in `--font-serif-display`, weight 500.

## Fonts — substitutions (flagged)

No font files were provided. Google-hosted substitutes chosen for the intended genre:
- Display serif → **Source Serif 4**
- UI sans → **Instrument Sans**
- Mono → **IBM Plex Mono**
Loaded via `@import` in `tokens/fonts.css` (network-hosted, no binaries shipped). Supply real font files to replace.

## Index

- `styles.css` — global entry; imports everything in `tokens/`.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`.
- `guidelines/` — foundation specimen cards (Design System tab).
- `components/forms/` — Button, IconButton, Input, Select, Checkbox, Radio, Switch.
- `components/display/` — Card, Badge, Tag.
- `components/navigation/` — Tabs.
- `components/feedback/` — Dialog, Toast, Tooltip, ActivityItem (cross-project notification row).
- `components/ai/` — ChatMessage, ChatComposer, ModelPicker, AgentTimeline (live multi-agent orchestration), VoiceAgentBar, SourceChip.
- `components/hitl/` — human-in-the-loop: ApprovalCard, DecisionPrompt, CanvasPanel (right-side document canvas, Codex-style read/copy/feedback-in-chat), PdfPage, SheetGrid.
- `components/commerce/` — CreditBalance, PaymentMethodRow (payments via Dodo Payments in copy).
- `ui_kits/console/` — Meridian Console (B2B app) screens + interactive `index.html`: Overview, Projects (files + chats/sub-chats), Chat (thread + agent timeline + canvas + voice), Activity, Knowledge, Appointments, Billing (credits + Dodo), API keys, Branding (live accent + wordmark theming), Settings.
- `SKILL.md` — agent-skill entry point.

### Intentional additions
No source defined a component inventory, so a standard B2B set was authored (listed above) — sized to dashboard/console needs.
