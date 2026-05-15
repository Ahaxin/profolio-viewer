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

Also add `grace_period` to the health check so the first deploy doesn't fail before the server finishes migrations:
```toml
[[http_service.checks]]
  path = "/api/health"
  interval = "10s"
  timeout = "5s"
  grace_period = "10s"
```

### `client/vercel.json`
Replace placeholder in the API rewrite destination:
```json
"destination": "https://profolio-viewer.fly.dev/api/$1"
```

### `server/app.js` — remove dead static-serving block
In the split deployment, `client/dist` does not exist inside the Docker image (the Dockerfile only copies `server/`). The production static-serving block is dead code and must be removed:

```js
// DELETE this block:
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
```

The `Dockerfile`, `server/db/database.js`, and `client/vite.config.js` are production-ready as-is.

---

## Secrets & Environment Variables

### Fly.io secrets (set via `flyctl secrets set`, never committed)

| Variable | Value |
|---|---|
| `JWT_SECRET` | Generated 48-char hex string (24 random bytes) |
| `SEED_USERNAME` | `ahaxin` |
| `SEED_PASSWORD` | Generated 24-char hex string (12 random bytes) |

`NODE_ENV`, `DB_PATH`, and `PORT` are already declared as plain (non-secret) env vars in `fly.toml`.

### Vercel
No environment variables needed. The frontend is a pure static build; all API calls go to Fly.io at runtime via the rewrite rule.

---

## Deployment Steps

### One-time: Install & authenticate CLIs
Use the `install-deployment-clis` skill. It covers installation, PATH fixes, and authentication (`flyctl auth login` + `vercel login`) for both tools. Complete all steps in the skill before proceeding.

### Code changes (before first deploy)
1. Update `fly.toml` — fill in `app`, `primary_region`, add `grace_period` to health check
2. Update `client/vercel.json` — fill in Fly.io app URL
3. Remove static-serving block from `server/app.js`

### Fly.io (run once; re-run `fly deploy` to redeploy)
1. `fly apps create profolio-viewer`
2. `fly volumes create portfolio_data --region ams --size-gb 1`
3. `fly secrets set JWT_SECRET=<generated> SEED_USERNAME=ahaxin SEED_PASSWORD=<generated>`
4. `fly deploy` from the project root

### Vercel (one-time GitHub integration setup)
1. `cd client && vercel` — follow prompts:
   - New project named `profolio-viewer`
   - Deploy from `./` (already inside `client/`)
   - Do not override build settings (Vite auto-detected)
2. Vercel connects to GitHub and will auto-deploy on every push to `master`

### Verification
- `https://profolio-viewer.fly.dev/api/health` → `{"ok":true}`
- Open Vercel URL → login as `ahaxin` with the generated password

---

## Secret Generation

Generate at deploy time (do not commit):
```bash
# JWT_SECRET (48-char hex = 24 random bytes)
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"

# SEED_PASSWORD (24-char hex = 12 random bytes)
node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"
```

---

## Out of Scope

- CI/CD for Fly.io (manual deploy only)
- Custom domains
- Multi-region Fly.io deployment
- Database backups
