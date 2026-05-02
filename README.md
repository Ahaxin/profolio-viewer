# Profolio Viewer

A personal portfolio tracker for managing assets, logging transactions, and viewing valuations over time.

## Features

- Asset management — add, edit, and track holdings
- Transaction history — log buys, sells, and other events
- Portfolio dashboard — summary bar with total value and performance
- Flat valuations — snapshot-based valuation history
- Live price data — fetched via Yahoo Finance
- JWT-based authentication — single-user, cookie-based session

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Vite |
| Backend | Node.js, Express |
| Database | SQLite via `better-sqlite3` |
| Auth | JWT + bcrypt |
| Hosting | Vercel (frontend) + Fly.io (backend) |

## Project Structure

```
profolio_viewer/
├── client/               # React/Vite frontend
│   ├── src/
│   │   ├── pages/        # LoginPage, DashboardPage, TransactionHistoryPage
│   │   ├── components/   # AssetTable, SummaryBar, AddAssetModal, AddValuationModal
│   │   ├── api.js        # Axios API client
│   │   └── App.jsx
│   └── vercel.json       # Rewrites /api/* to Fly.io backend
├── server/               # Express API
│   ├── routes/           # auth, portfolio, assets, transactions, prices, flatValuations
│   ├── db/               # database.js, migrations.js, seed.js
│   ├── middleware/        # auth.js (JWT verification)
│   └── index.js
├── Dockerfile            # Backend-only Docker image for Fly.io
└── fly.toml              # Fly.io config (app: profolio-viewer, region: ams)
```

## Local Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

Create a `server/.env` file:
```
JWT_SECRET=your-secret-here
SEED_USERNAME=yourname
SEED_PASSWORD=yourpassword
```

## Deployment

**Backend** — Fly.io (Amsterdam), Docker, SQLite on persistent volume:
```bash
fly deploy
```

**Frontend** — Vercel, auto-deploys on every push to `master`:
```bash
cd client && vercel --prod
```

See `docs/superpowers/plans/2026-05-02-fly-vercel-deployment.md` for the full deployment guide.

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Health check |
| POST | `/api/auth/login` | No | Login, returns JWT cookie |
| POST | `/api/auth/logout` | No | Clear session cookie |
| GET | `/api/portfolio` | Yes | Portfolio summary |
| GET/POST | `/api/assets` | Yes | List / add assets |
| PATCH/DELETE | `/api/assets/:id` | Yes | Update / delete asset |
| GET/POST | `/api/transactions` | Yes | List / add transactions |
| GET | `/api/transactions/export` | Yes | Export transactions as Excel |
| GET | `/api/prices` | Yes | Fetch live prices |
| GET/POST | `/api/flat-valuations` | Yes | List / add valuations |
