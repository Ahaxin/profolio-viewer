# Fly.io + Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Express/SQLite backend to Fly.io with a persistent volume, and the React/Vite frontend to Vercel with an `/api/*` rewrite proxy.

**Architecture:** Frontend static files are served from Vercel's CDN. All `/api/*` requests are rewritten by Vercel to the Fly.io backend URL, so the browser always sees same-origin requests and cookie auth works without CORS. SQLite lives on a Fly.io persistent volume mounted at `/data`.

**Tech Stack:** Node.js 20, Express, better-sqlite3, Docker, Fly.io (flyctl CLI), Vercel (web UI + vercel.json)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `.dockerignore` | Create | Exclude client source, node_modules, secrets from Docker build context |
| `Dockerfile` | Create | Build the server image; compiles better-sqlite3 native bindings for Linux |
| `fly.toml` | Create | Fly.io app config: port, health check, volume mount, env vars |
| `client/vercel.json` | Create | Vercel rewrite rules: proxy /api/* to Fly.io, SPA fallback |
| `server/routes/auth.js` | Modify | Change sameSite: 'strict' → 'lax' (recommended for Vercel proxy model) |
| `railway.toml` | Delete | Dead config from previous Railway approach |

---

### Task 1: Cleanup dead config and fix cookie sameSite

**Files:**
- Delete: `railway.toml`
- Modify: `server/routes/auth.js:34` and `:49`

> `sameSite: 'strict'` prevents the cookie being sent on cross-site navigations (e.g. arriving via an external link). With the Vercel proxy, the cookie is set on the Vercel origin, so login works — but `strict` causes intermittent "logged out" behaviour for users who click a link to the app from another tab or site. `lax` is the safer default.

- [ ] **Step 1: Delete railway.toml**

```bash
rm railway.toml
```

- [ ] **Step 2: Open server/routes/auth.js and find the cookie calls**

The file has two `sameSite` values to update:
- Line 34: inside the `/login` handler (`res.cookie`) — sets the auth cookie
- Line 49: inside the `/logout` handler (`res.clearCookie`) — clears the auth cookie

Both must be updated. The `clearCookie` attributes must match the original `Set-Cookie` attributes, otherwise some browsers will refuse to clear the cookie.

- [ ] **Step 3: Change sameSite to 'lax' in both cookie calls**

Find:
```js
sameSite: 'strict',
```

Replace both occurrences with:
```js
sameSite: 'lax',
```

- [ ] **Step 4: Run existing auth tests to confirm nothing breaks**

```bash
cd server && npm test -- --reporter=verbose 2>&1 | head -60
```

Expected: all auth tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/auth.js
git rm railway.toml
git commit -m "chore: remove railway config, use sameSite lax for Vercel proxy compatibility"
```

---

### Task 2: Create .dockerignore

**Files:**
- Create: `.dockerignore`

> Excludes everything from the Docker build context that the server image doesn't need. Critically: excludes all of `client/src`, `client/dist` etc. but keeps `client/package.json` — npm workspaces requires all workspace `package.json` files to be present when resolving the root lockfile during `npm ci`.

- [ ] **Step 1: Create .dockerignore at repo root**

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

- [ ] **Step 2: Verify client/package.json is NOT excluded**

```bash
cat .dockerignore | grep "^client"
```

Expected output should show per-subdirectory excludes (`client/src/`, `client/public/`, etc.) but NOT `client/` or `client/package.json`.

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "chore: add .dockerignore for Fly.io Docker build"
```

---

### Task 3: Create Dockerfile

**Files:**
- Create: `Dockerfile`

> This is an npm workspace project. The build must: (1) install native build tools for `better-sqlite3`; (2) copy root lockfile + both workspace `package.json` files; (3) run `npm ci --workspace=server --omit=dev` to install only server production deps with Linux-native bindings; (4) copy server source. Do NOT copy client source — it's excluded by `.dockerignore` and not needed at runtime.

- [ ] **Step 1: Create Dockerfile at repo root**

```dockerfile
FROM node:20-slim

# Native build deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root manifests first (for layer caching)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
# npm workspaces needs all member package.json files to resolve the workspace graph
COPY client/package.json ./client/

# Install server workspace deps only, production only
RUN npm ci --workspace=server --omit=dev

# Copy server source
COPY server/ ./server/

WORKDIR /app/server
EXPOSE 3001
CMD ["node", "index.js"]
```

- [ ] **Step 2: Verify the Dockerfile builds locally (optional but recommended)**

If Docker Desktop is installed:
```bash
docker build -t profolio-server .
```

Expected: build completes, `better-sqlite3` native module compiles without errors. If Docker is not available locally, skip — Fly.io will build it remotely.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: add Dockerfile for Fly.io backend deployment"
```

---

### Task 4: Create fly.toml

**Files:**
- Create: `fly.toml`

> `fly launch --no-deploy` generates a `fly.toml` with a random app name and sensible defaults. We replace its contents with our known-good config. The app name from `fly launch` becomes the subdomain (`<app-name>.fly.dev`) — note it down, you'll need it for `client/vercel.json` in Task 5.
>
> **Critical ordering constraint:** The persistent volume (`portfolio_data`) MUST be created before `fly deploy` runs. If the volume doesn't exist when the app boots, it cannot mount `/data` and the app will crash immediately.
>
> The `source` in `[[mounts]]` must exactly match the name used in `fly volumes create`.

- [ ] **Step 1: Install Fly CLI and log in**

```bash
curl -L https://fly.io/install.sh | sh
```

Then add it to your PATH if prompted (the installer will show the command). Then authenticate:

```bash
fly auth login
```

Follow the browser prompt to authenticate.

- [ ] **Step 2: Run fly launch to scaffold the app (do NOT deploy yet)**

```bash
fly launch --no-deploy
```

When prompted:
- Choose an app name (or accept the generated one) — **note this name down**
- Choose your nearest region (e.g. `sin` for Singapore, `syd` for Sydney, `nrt` for Tokyo, `lax` for LA)
- When asked "Would you like to set up a Postgresql database now?" — **No**
- When asked "Would you like to set up an Upstash Redis database now?" — **No**

This creates a `fly.toml` with your chosen app name and region.

- [ ] **Step 3: Replace the generated fly.toml contents with the config below**

Replace `<your-app-name>` with the name from Step 2, and `<your-region>` with your chosen region code:

```toml
app = "<your-app-name>"
primary_region = "<your-region>"

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

- [ ] **Step 4: Create the persistent volume**

Replace `<your-region>` with the same region chosen above:

```bash
fly volumes create portfolio_data --size 1 --region <your-region>
```

Expected output: a table showing the new volume with name `portfolio_data`, state `created`, size `1GB`.

- [ ] **Step 5: Set secrets**

Generate a strong JWT secret (e.g. `openssl rand -hex 32` in your terminal) and choose an admin username/password:

```bash
fly secrets set \
  JWT_SECRET=<your-long-random-string> \
  SEED_USERNAME=<your-admin-username> \
  SEED_PASSWORD=<your-strong-password>
```

Expected: `Secrets are staged for the first deployment`

- [ ] **Step 6: Deploy to Fly.io**

```bash
fly deploy
```

This builds the Docker image remotely and deploys it. First deploy takes ~3-4 minutes (native module compilation). Watch for the health check to pass.

Expected final line: `✓ Machine ... is healthy [ID: ...]` or similar success message.

- [ ] **Step 7: Verify backend is live**

```bash
fly logs
```

Look for: `Server running on port 3001` and no error messages.

```bash
curl https://<your-app-name>.fly.dev/api/health
```

Expected: `{"ok":true}`

- [ ] **Step 8: Commit fly.toml**

```bash
git add fly.toml
git commit -m "chore: add fly.toml for Fly.io deployment"
```

---

### Task 5: Create client/vercel.json and deploy to Vercel

**Files:**
- Create: `client/vercel.json`

> The `/api/(.*)` rewrite proxies all API calls from the Vercel frontend to the Fly.io backend. The `$1` capture group preserves the full path. The catch-all `/(.*) → /index.html` rewrite enables React Router client-side navigation (without it, refreshing a non-root URL returns 404).
>
> **Dependency:** Requires the Fly.io app name from Task 4.

- [ ] **Step 1: Create client/vercel.json**

Replace `<your-app-name>` with the Fly.io app name from Task 4:

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

- [ ] **Step 2: Commit**

```bash
git add client/vercel.json
git commit -m "chore: add vercel.json with Fly.io API rewrite and SPA fallback"
```

- [ ] **Step 3: Push to GitHub**

```bash
git push origin master
```

- [ ] **Step 4: Import the project on Vercel**

1. Go to vercel.com → New Project → Import from GitHub
2. Select the `profolio_viewer` repository
3. In "Configure Project":
   - **Root Directory:** `client`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
4. Click Deploy

Expected: build completes in ~1 minute, deployment URL shown (e.g. `profolio-viewer-xxx.vercel.app`).

- [ ] **Step 5: Smoke test the full stack**

Open the Vercel deployment URL in a browser.

Verify:
1. Login page loads
2. Login with the `SEED_USERNAME` / `SEED_PASSWORD` credentials set in Task 4 succeeds
3. Dashboard loads and shows an empty portfolio
4. Add an asset — confirm it persists on page refresh
5. Open DevTools → Network tab: `/api/*` requests show status 200 (not CORS errors)

---

## Rollback / Troubleshooting

**Fly.io: app won't start**
- `fly logs` — look for "Cannot open database" → volume may not be mounted; run `fly volumes list` to confirm `portfolio_data` exists and is attached
- `fly ssh console` → `ls /data` → should show `portfolio.db` after first boot

**Fly.io: health check failing**
- `curl https://<app>.fly.dev/api/health` — if timeout, the machine may still be starting; wait 60s and retry
- Check `fly status` for machine state

**Vercel: API calls returning 404**
- Confirm `client/vercel.json` is committed and the Fly.io app name is correct
- In Vercel dashboard → Deployments → check build logs for `vercel.json` parsing errors

**Vercel: page refresh returns 404**
- Confirm the catch-all rewrite (`/(.*) → /index.html`) is present in `client/vercel.json`
