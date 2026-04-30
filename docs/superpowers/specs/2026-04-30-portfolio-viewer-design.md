# Portfolio Viewer — Design Spec
**Date:** 2026-04-30

## Overview

A personal portfolio tracker web app where a single authenticated user can track stocks, crypto, real estate (flat), and other assets. Shows real-time prices, P&L in USD and percentage, and full transaction history. Deployed on Railway, published on GitHub.

---

## Architecture

**Stack:** Node.js (Express) backend + React (Vite) frontend — monorepo.

```
profolio-viewer/
├── client/          # React + Vite frontend
│   └── src/
└── server/          # Express + SQLite backend
    ├── routes/      # API route handlers
    ├── db/          # SQLite setup & migrations
    └── services/    # Price fetching (Yahoo Finance, CoinGecko)
```

**Request flow:**
1. React app makes API calls to `/api/*`
2. Express checks JWT (httpOnly cookie) for protected routes
3. Express queries SQLite for portfolio data
4. Express calls Yahoo Finance (stocks) / CoinGecko (crypto) for live prices
5. Combined data is returned to React

**Production:** Express serves built React files from `client/dist` as static assets — one process, one port, one Railway service, one URL.

**GitHub:** Source hosted on GitHub; Railway auto-deploys on push to main.

---

## Authentication

- Single user; no registration page — credentials seeded in DB at setup
- Password hashed with **bcrypt**
- Login issues a **JWT** stored in an **httpOnly cookie** (XSS-safe)
- All `/api/*` routes except `/api/auth/login` protected by JWT middleware

---

## Data Model (SQLite)

### `assets`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | auto-increment |
| type | TEXT | `stock`, `crypto`, `flat`, `other` |
| symbol | TEXT | e.g. `AAPL`, `BTC`, `My Flat` |
| name | TEXT | display name |
| created_at | DATETIME | default now |

### `transactions`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| asset_id | INTEGER FK → assets.id | |
| action | TEXT | `buy` or `sell` |
| quantity | REAL | |
| price_usd | REAL | price per unit at trade time |
| date | DATE | |
| created_at | DATETIME | |

### `prices_cache`
| column | type | notes |
|---|---|---|
| symbol | TEXT PK | |
| price_usd | REAL | |
| updated_at | DATETIME | |

### `flat_valuations`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| asset_id | INTEGER FK → assets.id | |
| value_usd | REAL | manually entered valuation |
| date | DATE | |

**P&L calculation:** `(current_price - avg_buy_price) × net_quantity`, computed at query time.

---

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, sets JWT cookie |
| POST | `/api/auth/logout` | Clears JWT cookie |
| GET | `/api/portfolio` | All assets with live price, P&L, total value |
| POST | `/api/assets` | Add new asset |
| DELETE | `/api/assets/:id` | Remove asset |
| POST | `/api/transactions` | Record a buy/sell transaction |
| GET | `/api/transactions/:assetId` | Transaction history for one asset |
| GET | `/api/prices/:symbol` | Fetch live price for a symbol |

All routes except `POST /api/auth/login` require a valid JWT cookie.

---

## Frontend Pages

### Login Page
- Username + password form
- Redirects to dashboard on success

### Dashboard (main page)
- **Summary bar:** total portfolio value (USD), total P&L (USD + %)
- **Asset table:** symbol, type, quantity, avg buy price, current price, current value, P&L USD, P&L %, last updated
- **Add Asset / Transaction button:** modal form — type, symbol, quantity, price paid, date
- **Auto-refresh** live prices every 5 minutes + manual Refresh button

### Transaction History Page
- Click any asset row on dashboard to see full buy/sell history in a table

---

## External Price APIs

| Asset type | API | Notes |
|---|---|---|
| Stocks | Yahoo Finance (via `yahoo-finance2` npm package) | Free, no API key needed |
| Crypto | CoinGecko public API | Free tier, rate-limited |
| Flat / Other | Manual entry only | No external API |

Prices cached in `prices_cache` table, refreshed at most every 5 minutes to respect rate limits.

---

## Deployment

- **Platform:** Railway (free tier — $5/month credit)
- **Database:** SQLite on Railway persistent disk
- **CI/CD:** Railway connected to GitHub main branch — auto-deploy on push
- **Environment variables:** `JWT_SECRET`, `SEED_USERNAME`, `SEED_PASSWORD` set in Railway dashboard

---

## Out of Scope

- Multi-user support
- Email/password reset
- Mobile app
- Currency conversion (all values in USD)
- Real-time property valuations (manual entry only)
