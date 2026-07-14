# LinkUp — Web Search API Integration Guide

> Status: **account live, $50 credit redeemed on 12 Jul 2026** (Hermes Buildathon perk, code `HERMES`).
> Account: Sanyam Jain — team "default". Not yet wired into the product; this doc is the plan + how-to.

## What LinkUp gives us

LinkUp is a **web search API built for AI agents**. You send it a question, it searches the
**live web** in real time and hands back either raw ranked results, a written answer with its
sources, or structured JSON you define. This is the piece that lets Hermes Researcher pull in
**fresh, cited external evidence** (market data, competitor info, public signals) instead of relying
only on what the model already knows.

Three output shapes, one endpoint:
- **`searchResults`** — a ranked list of URLs + snippets (you decide what to do with them).
- **`sourcedAnswer`** — a written answer *plus* the sources it used. Best default for research.
- **`structured`** — you pass a JSON schema, it returns data in exactly that shape.

Two depths: **`standard`** (fast, sub-second) and **`deep`** (slower, more thorough).

## Credentials (where everything lives)

| Thing | Value / location |
|---|---|
| Registered email | `jsanyam3501@gmail.com` |
| Dashboard | https://app.linkup.so |
| API keys page | https://app.linkup.so/api-keys |
| Team | `default` |
| Credit | **$50** redeemed via code `HERMES` (Settings → Add Credits) |
| **API key** | **Not stored in this repo.** Get it from the [API keys page](https://app.linkup.so/api-keys); it lives locally in `.env.local` as `LINKUP_API_KEY` (git-ignored). |

> ⚠️ Never put the raw key in a committed file. It belongs only in `.env.local` (git-ignored) and on
> the Convex deployment (`pnpm exec convex env set LINKUP_API_KEY <value>`). Reveal/rotate it any time
> on the [API keys page](https://app.linkup.so/api-keys).

## Endpoint

```
POST https://api.linkup.so/v1/search
Authorization: Bearer <LINKUP_API_KEY>
Content-Type: application/json
```

Quick sanity check from the terminal (uses the key from your shell env):

```bash
curl -X POST https://api.linkup.so/v1/search \
  -H "Authorization: Bearer $LINKUP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "q": "What is Microsoft'\''s 2024 revenue?",
    "depth": "standard",
    "outputType": "sourcedAnswer"
  }'
```

## How it plugs into our stack (Convex)

Our backend is Convex, and Convex **actions** are where outbound API calls belong (they can use
`fetch` and read `process.env`). So a LinkUp call lives in a Convex action, exactly like our
existing AI-gateway calls in `convex/hermes.ts` / `convex/interviews.ts`.

`convex/linkup.ts` (new file — sketch):

```ts
"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

const LINKUP_URL = "https://api.linkup.so/v1/search";

export const webSearch = action({
  args: {
    query: v.string(),
    depth: v.optional(v.union(v.literal("standard"), v.literal("deep"))),
  },
  handler: async (_ctx, { query, depth }) => {
    const apiKey = process.env.LINKUP_API_KEY;
    if (!apiKey) throw new Error("LINKUP_API_KEY is not set on the Convex deployment");

    const res = await fetch(LINKUP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        depth: depth ?? "standard",
        outputType: "sourcedAnswer",
      }),
    });

    if (!res.ok) {
      throw new Error(`LinkUp ${res.status}: ${await res.text()}`);
    }
    // { answer: string, sources: [{ name, url, snippet }, ...] }
    return await res.json();
  },
});
```

Because it's a Convex action, `process.env.LINKUP_API_KEY` is read from the **Convex deployment
env**, not from `.env.local`. So set it once on the deployment:

```bash
pnpm exec convex env set LINKUP_API_KEY <the-key-from-.env.local>
```

(There's also an official SDK, `npm i linkup-sdk`, if we'd rather use `client.search(...)` than
raw `fetch`. The `fetch` version above has zero extra dependencies, which is why it's the default here.)

## Where we'd actually use it in the product

- **Research Strategist** — pull live market/competitor context while drafting a Study Plan.
- **Analyst Agent** — fact-check or enrich findings against current public sources, with citations
  (LinkUp returns the source URLs, which fits our "evidence + sources" model).

## Cost / budget

Billed per search out of the $50 credit; `deep` costs more than `standard`. $50 is thousands of
searches — plenty for the buildathon and well beyond. Watch usage under **Billing** on the dashboard.
Start every feature on `standard` and only switch to `deep` where the extra depth is clearly worth it.

## Gotchas

- **Never commit the key.** It lives in `.env.local` (frontend/CLI) and on the Convex deployment
  (server actions). If it ever leaks, delete it on the API keys page and create a new one.
- **Two places to set it.** `.env.local` alone is *not* enough for server-side Convex actions —
  you must also run `convex env set LINKUP_API_KEY ...`.
- **Test in the Playground first** — https://app.linkup.so/playground lets you try queries with no
  code, so you can see the response shape before wiring it up.
```
