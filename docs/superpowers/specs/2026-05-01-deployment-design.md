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

**`Dockerfile`** (at repo root, targeting `server/`)
- Base image: `node:20-slim`
- Install native build deps for `better-sqlite3` (python3, make, g++)
- Copy `server/` and install production dependencies
- Expose port 3001
- CMD: `node index.js`

**`fly.toml`** (at repo root)
- App name chosen at `fly launch` time
- Internal port: 3001
- Health check: `GET /api/health` → 200
- Mounts: persistent volume at `/data`
- `[env]`: `NODE_ENV=production`, `DB_PATH=/data/portfolio.db`, `PORT=3001`

**`server/routes/health.js`**
- `GET /api/health` → `res.json({ ok: true })`
- Required by Fly.io health checks before marking deployment live

### Secrets (set via `fly secrets set`)

| Secret | Value |
|--------|-------|
| `JWT_SECRET` | Long random string |
| `SEED_USERNAME` | Admin username |
| `SEED_PASSWORD` | Strong password |

### Persistent Volume

- Created with `fly volumes create portfolio_data --size 1` (1GB, free tier)
- Mounted at `/data` in `fly.toml`
- `DB_PATH=/data/portfolio.db` → SQLite file lives on the volume, survives deploys/restarts

### Deployment Steps

1. `fly launch` from repo root (creates app, detects Dockerfile)
2. `fly volumes create portfolio_data --size 1 --region <region>`
3. `fly secrets set JWT_SECRET=... SEED_USERNAME=... SEED_PASSWORD=...`
4. `fly deploy`

## Frontend: Vercel

### Files to create

**`client/vercel.json`**
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://<fly-app-name>.fly.dev/api/$1"
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

### Vercel Project Settings

| Setting | Value |
|---------|-------|
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |

### Deployment Steps

1. Push repo to GitHub
2. Import project on Vercel, set root directory to `client`
3. After Fly.io is deployed, update `client/vercel.json` with the actual Fly.io app URL
4. Deploy on Vercel (auto-deploys on every push to `master`)

## No Client Code Changes Required

The frontend `api.js` uses relative paths (`/api/auth/login`, etc.) and `credentials: 'include'`. The Vercel rewrite makes the Fly.io backend transparent to the browser — no `VITE_API_BASE_URL` env var, no CORS config, no changes to `api.js`.

## Data

Starting fresh — no migration needed. On first boot, `server/index.js` runs migrations and seeds the admin user from `SEED_USERNAME` / `SEED_PASSWORD` secrets.

## Files Changed/Created

| File | Action |
|------|--------|
| `Dockerfile` | Create |
| `fly.toml` | Create |
| `server/routes/health.js` | Create |
| `server/app.js` | Edit — register health route |
| `client/vercel.json` | Create |
