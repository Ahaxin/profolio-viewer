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

- Single user; no registration page — credentials seeded in DB at setup via a seed script
- Password hashed with **bcrypt**
- Login issues a **JWT** stored in an **httpOnly, SameSite=Strict cookie** (XSS-safe, CSRF-safe)
- JWT expiration: **7 days**; user must re-login after expiry
- All `/api/*` routes except `POST /api/auth/login` protected by JWT middleware
- Login endpoint rate-limited to **10 attempts per 15 minutes** per IP (using `express-rate-limit`)
- SQLite has no auth credentials — it is a server-side file never exposed to the network; security relies on Railway's isolated container environment

---

## Data Model (SQLite)

All DATETIME values stored as **UTC ISO 8601 strings**. The frontend displays them in the user's local timezone.

### `assets`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | auto-increment |
| type | TEXT | `stock`, `crypto`, `flat`, `other` |
| symbol | TEXT | e.g. `AAPL`, `BTC`, `My Flat` |
| name | TEXT | display name |
| created_at | DATETIME | UTC, default now |

### `transactions`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| asset_id | INTEGER FK → assets.id | CASCADE DELETE |
| action | TEXT | `buy` or `sell` |
| quantity | REAL | |
| price_usd | REAL | price per unit at trade time |
| date | DATE | user-entered date (UTC) |
| created_at | DATETIME | UTC |

### `prices_cache`
| column | type | notes |
|---|---|---|
| symbol | TEXT PK | |
| price_usd | REAL | |
| updated_at | DATETIME | UTC |

### `flat_valuations`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| asset_id | INTEGER FK → assets.id | CASCADE DELETE |
| value_usd | REAL | manually entered valuation |
| date | DATE | user-entered date (UTC) |

**P&L calculation (computed at query time):**
- `avg_buy_price` = total cost of all buys ÷ total bought quantity
- `net_quantity` = total bought − total sold
- `current_value` = `net_quantity × current_price`
- `P&L` = `(current_price − avg_buy_price) × net_quantity`
- If `net_quantity = 0` (all shares sold): show as a closed position with realized P&L only; exclude from total portfolio value

**Delete cascade:** Deleting an asset cascades to its `transactions` and `flat_valuations` rows.

---

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, sets JWT cookie (rate-limited) |
| POST | `/api/auth/logout` | Clears JWT cookie |
| GET | `/api/portfolio` | All assets with live price, P&L, total value |
| POST | `/api/assets` | Add new asset |
| DELETE | `/api/assets/:id` | Remove asset + cascade |
| POST | `/api/transactions` | Record a buy/sell transaction |
| GET | `/api/transactions/:assetId` | Transaction history for one asset |
| GET | `/api/prices/:symbol` | Fetch live price for a symbol |
| POST | `/api/flat-valuations` | Add a manual valuation for a flat/other asset |

All routes except `POST /api/auth/login` require a valid JWT cookie.

---

## Frontend Pages

### Login Page
- Username + password form
- Redirects to dashboard on success

### Dashboard (main page)
- **Summary bar:** total portfolio value (USD), total P&L (USD + %)
- **Asset table:** symbol, type, quantity, avg buy price, current price, current value, P&L USD, P&L %, last updated
  - Stale prices (> 5 min old) shown with a warning indicator and the last known price
  - If price fetch fails entirely, show last cached price with "stale" label and timestamp
- **Add Asset / Transaction button:** modal form — type, symbol, quantity, price paid, date
- **Auto-refresh** live prices every 5 minutes + manual Refresh button

### Transaction History Page
- Click any asset row on dashboard to see full buy/sell history in a table

---

## External Price APIs

| Asset type | API | Notes |
|---|---|---|
| Stocks | Yahoo Finance (via `yahoo-finance2` npm package) | Free, no API key needed |
| Crypto | CoinGecko public API | Free tier, ~30 req/min |
| Flat / Other | Manual entry only | No external API |

**Caching strategy:** All symbols are fetched in a single batch call (not one request per symbol) to minimise API calls. Results stored in `prices_cache`, refreshed at most every 5 minutes. If a fetch fails, the last cached value is returned with a stale flag — the dashboard never shows an error-broken state.

---

## Deployment

- **Platform:** Railway (free tier — $5/month credit)
- **Database:** SQLite file on Railway persistent disk (`/data/portfolio.db`)
- **CI/CD:** Railway connected to GitHub main branch — auto-deploy on push
- **Environment variables set in Railway dashboard:**
  - `JWT_SECRET` — long random string (rotate manually if compromised; all existing sessions invalidate immediately)
  - `SEED_USERNAME` — initial login username
  - `SEED_PASSWORD` — initial login password (used once by seed script, then ignored)
  - `NODE_ENV=production`

---

## Out of Scope

- Multi-user support
- Email/password reset
- Mobile app
- Currency conversion (all values in USD)
- Real-time property valuations (manual entry only)
- CSRF token rotation (mitigated by SameSite=Strict cookie)
- JWT revocation list (acceptable for personal single-user use)
