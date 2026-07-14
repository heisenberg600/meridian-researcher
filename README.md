# Meridian

Meridian is an AI-assisted research operations platform that helps companies turn a business question into a designed, executed, and evidence-backed customer study.

The intended workflow is:

> Business question → study design → human approval → participant outreach → AI-led interviews → evidence synthesis → decision report

## Current status

The project uses a Vite React frontend, Clerk authentication, and Convex for the backend.

## Documentation

- [High-level product components](docs/PRODUCT_COMPONENTS.md)
- [Research workflow and agent contracts](docs/RESEARCH_WORKFLOW.md)
- [Convex agent platform plan](docs/CONVEX_AGENT_PLATFORM_PLAN.md)

## Local setup

1. Fill `.env.local` with `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, Clerk keys, and other local values.
2. In Clerk, create a Convex JWT template with audience/application ID `convex`.
3. Set the issuer URL on the Convex deployment:

```bash
pnpm exec convex env set CLERK_JWT_ISSUER_DOMAIN <clerk-jwt-issuer-url>
```

4. Regenerate Convex types and run the app:

```bash
pnpm exec convex codegen
pnpm run convex:dev
pnpm run dev
```

## Frontend deployment

The frontend is a static Vite app and can be deployed to Cloudflare Pages.

Required Cloudflare Pages environment variables:

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

Required Convex environment variables for the AI runtime:

- `AI_GATEWAY_API_KEY`
- `LINKUP_API_KEY` — enables the agent's source-citing `web_search` tool

Deploy from the CLI:

```bash
pnpm run deploy:cloudflare
```

This uses classic Cloudflare Pages deployment via Wrangler because the app is a static Vite SPA.

CI/CD setup is documented in [docs/CLOUDFLARE_CICD.md](docs/CLOUDFLARE_CICD.md). The GitHub Actions workflow builds pull requests and deploys pushes to `main` to Cloudflare Pages.

## Guiding principles

- Start with the business decision, not a blank survey.
- Require human approval before participant contact or material study changes.
- Keep every finding traceable to source evidence.
- Treat consent, privacy, and outreach controls as core product behavior.
- Report sample limitations and uncertainty honestly.
- Build one complete research workflow before supporting every methodology.
