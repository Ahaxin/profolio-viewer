# Fly.io + Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the profolio-viewer backend to Fly.io (Amsterdam) and frontend to Vercel with GitHub auto-deploy.

**Architecture:** Express/SQLite backend runs in Docker on Fly.io with a persistent volume. React/Vite frontend is a static build hosted on Vercel CDN. Vercel rewrites `/api/*` to `https://profolio-viewer.fly.dev/api/*` at the edge.

**Tech Stack:** Node.js 20, Express, better-sqlite3, flyctl CLI, Vercel CLI, Docker (managed by Fly.io)

> **Note:** All config file changes (`fly.toml`, `client/vercel.json`, `server/app.js`) are already committed. No code changes are needed — this plan is purely infrastructure and CLI commands.

---

### Task 1: Install and Authenticate CLIs

**Prerequisites:** Windows 11, Node.js installed, Fly.io and Vercel accounts exist.

**Files:** None

- [ ] **Step 1: Follow the `install-deployment-clis` skill**

  Invoke the skill and complete every step, including:
  - Install `flyctl` via `winget install flyctl`
  - Close and reopen terminal (PATH won't update until you do)
  - `flyctl auth login` → opens browser, log in with Fly.io account
  - Install Vercel CLI: `npm install -g vercel`
  - `vercel login` → choose GitHub, complete browser auth

- [ ] **Step 2: Verify both CLIs are authenticated**

  Run:
  ```bash
  flyctl auth whoami
  vercel whoami
  ```
  Expected: both print your username. If either fails, revisit the `install-deployment-clis` skill for PATH troubleshooting.

---

### Task 2: Generate Secrets

**Files:** None (secrets are never committed — store them in a password manager or note them for use in Task 3)

- [ ] **Step 1: Generate JWT_SECRET**

  Run from the project root:
  ```bash
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```
  Copy the output (48-char hex string). This is your `JWT_SECRET`.

- [ ] **Step 2: Generate SEED_PASSWORD**

  Run:
  ```bash
  node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"
  ```
  Copy the output (24-char hex string). This is your `SEED_PASSWORD`. The login username is `ahaxin`.

- [ ] **Step 3: Store both values somewhere safe**

  You will need them in Task 3 Step 3 and for logging in during verification. Do not commit them to git.

---

### Task 3: Deploy to Fly.io

**Working directory:** project root (`F:/PROJECTS/profolio_viewer`)

- [ ] **Step 1: Create the Fly.io app**

  ```bash
  fly apps create profolio-viewer
  ```
  Expected output: `New app created: profolio-viewer`

  If the name is taken, you'll see an error — choose a different name and update `fly.toml` and `client/vercel.json` to match.

- [ ] **Step 2: Create the persistent volume**

  ```bash
  fly volumes create portfolio_data --region ams --size-gb 1
  ```
  Expected output: a table showing the new volume with `State: created` and `Region: ams`.

- [ ] **Step 3: Set secrets**

  Replace `<jwt>` and `<password>` with the values from Task 2:
  ```bash
  fly secrets set JWT_SECRET=<jwt> SEED_USERNAME=ahaxin SEED_PASSWORD=<password>
  ```
  Expected output: `Secrets are staged for the first deployment`

- [ ] **Step 4: Deploy**

  ```bash
  fly deploy
  ```
  This builds the Docker image and deploys it. First deploy takes ~2 minutes.

  Expected: output ends with `Monitoring deployment` then `1 desired, 1 placed, 1 healthy, 0 unhealthy`.

  If health checks fail, run `fly logs` to see server output.

- [ ] **Step 5: Verify backend is live**

  ```bash
  curl https://profolio-viewer.fly.dev/api/health
  ```
  Expected: `{"ok":true}`

  Alternatively open the URL in a browser — you should see the JSON response.

---

### Task 4: Deploy to Vercel

**Working directory:** `client/` (`F:/PROJECTS/profolio_viewer/client`)

- [ ] **Step 1: Run the Vercel deploy wizard**

  ```bash
  cd client
  vercel
  ```

  Answer the prompts as follows:

  | Prompt | Answer |
  |---|---|
  | Set up and deploy? | `Y` |
  | Which scope? | Your personal Vercel account |
  | Link to existing project? | `N` |
  | Project name? | `profolio-viewer` |
  | Directory? | `./` (current, already inside `client/`) |
  | Override build settings? | `N` |

  Vercel auto-detects Vite and sets `npm run build` with `dist` as output directory.

  Expected: deploy completes and prints a preview URL like `https://profolio-viewer-xxxx.vercel.app`.

- [ ] **Step 2: Verify the Vercel deployment**

  Open the preview URL from Step 1 in a browser.

  Expected: the login page loads. Log in with username `ahaxin` and the `SEED_PASSWORD` from Task 2.

  Expected after login: the portfolio dashboard loads with no errors.

- [ ] **Step 3: Promote to production**

  ```bash
  vercel --prod
  ```
  Expected: prints the production URL `https://profolio-viewer.vercel.app` (or similar).

- [ ] **Step 4: Verify API calls work from the production URL**

  Open the production URL in a browser. Log in as `ahaxin`. Navigate to any page that loads data (e.g. assets or transactions).

  Expected: data loads correctly. Open browser DevTools → Network tab to confirm `/api/*` requests are returning 200 responses from `profolio-viewer.fly.dev`.

---

### Task 5: Verify GitHub Auto-Deploy

- [ ] **Step 1: Confirm GitHub is connected**

  In the Vercel dashboard (`vercel.com`), open the `profolio-viewer` project → Settings → Git.
  Expected: your GitHub repo (`Ahaxin/profolio-viewer` or similar) is listed as the connected repository.

  If not connected: click "Connect Git Repository" and follow the prompts to link it.

- [ ] **Step 2: Test auto-deploy with a trivial commit**

  Make a whitespace change to any client file (e.g. add a blank line to `client/src/main.jsx`), commit, and push:
  ```bash
  git add client/src/main.jsx
  git commit -m "chore: test vercel auto-deploy"
  git push
  ```

- [ ] **Step 3: Confirm Vercel picked it up**

  In the Vercel dashboard, check the Deployments tab. Expected: a new deployment triggered by the push appears within 30 seconds and completes successfully.

- [ ] **Step 4: Revert the test commit (optional)**

  ```bash
  git revert HEAD --no-edit
  git push
  ```
