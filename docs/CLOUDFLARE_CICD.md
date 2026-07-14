# Cloudflare CI/CD

This project deploys the Vite frontend to Cloudflare Pages with Wrangler direct upload from GitHub Actions.

## One-time Cloudflare setup

Create the Pages project if it does not already exist:

```bash
pnpm exec wrangler pages project create hermes-researcher --production-branch main
```

Create a Cloudflare API token with permission to deploy Pages for the target account, then add these GitHub repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

Required Convex runtime values such as `AI_GATEWAY_API_KEY`, `LINKUP_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, and `CLERK_JWT_ISSUER_DOMAIN` should be set on the Convex deployment with `pnpm exec convex env set`.

## Deployment flow

- Pull requests to `main` install dependencies and run `pnpm run build`.
- Pushes to `main` build and deploy `dist` to the `hermes-researcher` Cloudflare Pages project.
- Manual deployments can be started from the GitHub Actions `Cloudflare Pages` workflow.

Local deploys still work with:

```bash
pnpm run deploy:cloudflare
```

## Git origin

The expected GitHub origin for this repository is:

```bash
https://github.com/heisenberg600/meridian-researcher.git
```

To point a local checkout at this repository, run:

```bash
git remote set-url origin https://github.com/heisenberg600/meridian-researcher.git
git push -u origin main
```
