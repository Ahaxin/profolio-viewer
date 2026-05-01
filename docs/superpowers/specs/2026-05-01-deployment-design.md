# Deployment Design: Fly.io (Backend) + Vercel (Frontend)

**Date:** 2026-05-01
**Status:** Approved

## Overview

Deploy the portfolio viewer as two separate services:
- **Frontend** (React/Vite) → Vercel (static hosting, CDN)
- **Backend** (Express + SQLite) → Fly.io (persistent volume for SQLite)

API calls from the frontend use relative `/api/*` paths. A Vercel rewrite proxies these to the Fly.io backend, so cookie-based auth works without any CORS configuration or client code changes.

## Architecture

```
Browser → Vercel (React static files)
            └─ /api/* rewrite → Fly.io (Express + SQLite on persistent volume)
```

## Backend: Fly.io

### Files to create

**`Dockerfile`** (at repo root)

This is an npm workspace project (`package.json` has `"workspaces": ["server", "client"]`). The Dockerfile must copy the root lockfile and install only the server workspace to get `better-sqlite3` native bindings built correctly for Linux.

> **npm workspace note:** `npm ci --workspace=server` resolves against the root lockfile and requires all workspace `package.json` files to be present. `client/package.json` must be copied even though client source is excluded by `.dockerignore`. The root has no production dependencies of its own — only `concurrently` in devDependencies — so `--omit=dev` covers it.

```dockerfile
FROM node:20-slim

# Native build deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root manifests first (for layer caching)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
# npm workspaces needs all member package.json files to resolve the graph
COPY client/package.json ./client/

# Install server workspace deps only, production only
RUN npm ci --workspace=server --omit=dev

# Copy server source
COPY server/ ./server/

WORKDIR /app/server
EXPOSE 3001
CMD ["node", "index.js"]
```

**`.dockerignore`** (at repo root)

Exclude client source but allow `client/package.json` (required by npm workspaces during `npm ci`):

```
node_modules/
client/src/
client/public/
client/dist/
client/node_modules/
docs/
.env
.env.*
*.db
*.db-shm
*.db-wal
/data/
```

**`fly.toml`** (at repo root)

```toml
app = "<your-app-name>"
primary_region = "sin"   # change to your nearest region

[build]

[env]
  NODE_ENV = "production"
  DB_PATH = "/data/portfolio.db"
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true

  [[http_service.checks]]
    path = "/api/health"
    interval = "10s"
    timeout = "5s"

[[mounts]]
  source = "portfolio_data"
  destination = "/data"
```

> **Note:** The `source` value in `[mounts]` must exactly match the volume name used in `fly volumes create`. A mismatch is the most common Fly.io deployment failure.

> **Note on `fly launch`:** Running `fly launch` will interactively generate and overwrite `fly.toml`. Run `fly launch --no-deploy` first to get a generated config, then replace its contents with the above before running `fly deploy`.

### Health check

`GET /api/health` already exists in `server/app.js` (line 19) — no new files needed.

### Static file serving (dead code in split deployment)

`server/app.js` lines 33–39 serve `client/dist` when `NODE_ENV=production`. In the Fly.io image, `client/dist` won't exist, so this block is harmless dead code (the static middleware silently skips a missing directory, and the catch-all `GET *` handler returns a 404 for `index.html`). It does not need to be removed for the deployment to work.

### Secrets (set via `fly secrets set`)

| Secret | Value |
|--------|-------|
| `JWT_SECRET` | Long random string |
| `SEED_USERNAME` | Admin username |
| `SEED_PASSWORD` | Strong password |

> `dotenv` is called in production but silently ignores a missing `.env` file — all values come from Fly.io secrets and the `[env]` table above.

### Cookie `sameSite` note

`server/routes/auth.js:34` sets `sameSite: 'strict'`. With the Vercel proxy model, the cookie is set on the Vercel origin (not Fly.io), so login works. However, `strict` means the cookie is not sent on cross-site navigations (e.g. clicking a link to the app from another site). Changing to `sameSite: 'lax'` is safer for this deployment model and avoids intermittent "logged out" behaviour for users arriving via external links. This is a recommended change but not blocking.

### Deployment Steps (Fly.io)

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh` then `fly auth login`
2. Run `fly launch --no-deploy` from repo root to scaffold the app (choose region, skip deploy)
3. Replace the generated `fly.toml` with the config above, substituting `<your-app-name>`
4. **Create volume first** (must exist before deploy or the app crashes on boot):
   ```
   fly volumes create portfolio_data --size 1 --region <region>
   ```
5. Set secrets:
   ```
   fly secrets set JWT_SECRET=... SEED_USERNAME=... SEED_PASSWORD=...
   ```
6. Deploy:
   ```
   fly deploy
   ```
7. Verify: `fly logs` and `curl https://<your-app-name>.fly.dev/api/health`

## Frontend: Vercel

### Files to create

**`client/vercel.json`**

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://<your-app-name>.fly.dev/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- The `/api/*` rewrite proxies API calls to Fly.io — no CORS needed, cookies work as same-origin
- The catch-all rewrite enables React Router client-side navigation
- `$1` backreferences are supported by Vercel's rewrite engine

### Vercel Project Settings

| Setting | Value |
|---------|-------|
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |

### Deployment Steps (Vercel)

1. Push repo to GitHub
2. Import project on Vercel → set root directory to `client`
3. After Fly.io is live, update `client/vercel.json` with the actual app name
4. Vercel deploys automatically on every push to `master`

## No Client Code Changes Required

The frontend `api.js` uses relative paths (`/api/auth/login`, etc.) and `credentials: 'include'`. The Vercel rewrite makes the Fly.io backend transparent to the browser — no `VITE_API_BASE_URL` env var, no CORS config, no changes to `api.js`.

## Data

Starting fresh — no migration needed. On first boot, `server/index.js` runs migrations and seeds the admin user from `SEED_USERNAME` / `SEED_PASSWORD` secrets.

## Files Changed/Created

| File | Action |
|------|--------|
| `Dockerfile` | Create |
| `.dockerignore` | Create |
| `fly.toml` | Create |
| `client/vercel.json` | Create |
