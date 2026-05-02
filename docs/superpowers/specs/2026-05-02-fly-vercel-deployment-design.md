# Deployment Design: Fly.io (Backend) + Vercel (Frontend)

**Date:** 2026-05-02
**Project:** profolio-viewer

---

## Architecture

```
GitHub (master branch)
    ↓ auto-deploy on push (Vercel GitHub integration)
Vercel (React SPA, static CDN)
    ↓ /api/* rewrites
Fly.io app: profolio-viewer (Amsterdam, ams)
    ↓
SQLite on persistent Fly volume (/data/portfolio.db, 1GB)
```

- **Frontend**: Vercel hosts the built React/Vite SPA as static files on CDN. Auto-deploys on every push to `master`.
- **Backend**: Fly.io runs the Express server in Docker. Deployed manually via `flyctl`. Region: `ams` (Amsterdam).
- **Database**: SQLite via `better-sqlite3`, stored on a persistent Fly volume so data survives deploys.
- **API routing**: `client/vercel.json` rewrites all `/api/*` requests to `https://profolio-viewer.fly.dev/api/$1`. CORS is not needed since rewrites run server-side.

---

## Configuration Changes

### `fly.toml` (project root)
Replace placeholders:
```toml
app = "profolio-viewer"
primary_region = "ams"
```
Everything else in `fly.toml` is already correct (`PORT=3001`, `DB_PATH=/data/portfolio.db`, `NODE_ENV=production`, health check at `/api/health`, volume mount at `/data`).

### `client/vercel.json`
Replace placeholder in the API rewrite destination:
```json
"destination": "https://profolio-viewer.fly.dev/api/$1"
```

No other code changes required. The `Dockerfile`, `server/app.js`, `server/db/database.js`, and `client/vite.config.js` are all production-ready as-is.

---

## Secrets & Environment Variables

### Fly.io secrets (set via `flyctl secrets set`, never committed)

| Variable | Value |
|---|---|
| `JWT_SECRET` | Generated 48-char random hex string |
| `SEED_USERNAME` | `ahaxin` |
| `SEED_PASSWORD` | Generated 24-char random string |

`NODE_ENV`, `DB_PATH`, and `PORT` are already declared as plain (non-secret) env vars in `fly.toml`.

### Vercel
No environment variables needed. The frontend is a pure static build; all API calls go to Fly.io at runtime via the rewrite rule.

---

## Deployment Steps

### One-time: Install & authenticate CLIs
Use the `install-deployment-clis` skill.

### Fly.io (run once; re-run `fly deploy` to redeploy)
1. Update `fly.toml` placeholders (app name, region)
2. `fly apps create profolio-viewer`
3. `fly volumes create portfolio_data --region ams --size 1`
4. `fly secrets set JWT_SECRET=<generated> SEED_USERNAME=ahaxin SEED_PASSWORD=<generated>`
5. `fly deploy` from the project root

### Vercel (one-time GitHub integration setup)
1. Update `client/vercel.json` placeholder (Fly.io URL)
2. `cd client && vercel` — follow prompts:
   - New project named `profolio-viewer`
   - Deploy from `./` (already inside `client/`)
   - Do not override build settings (Vite auto-detected)
3. Vercel connects to GitHub and will auto-deploy on every push to `master`

### Verification
- `https://profolio-viewer.fly.dev/api/health` → `{"ok":true}`
- Open Vercel URL → login as `ahaxin` with the generated password

---

## Secret Generation

Generate at deploy time (do not commit):
```bash
# JWT_SECRET (48-char hex)
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# SEED_PASSWORD (24-char random)
node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"
```

---

## Out of Scope

- CI/CD for Fly.io (manual deploy only)
- Custom domains
- Multi-region Fly.io deployment
- Database backups
