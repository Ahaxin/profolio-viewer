# Portfolio Improvements — Progress Tracker

**Last updated:** 2026-05-17
**Spec:** `docs/superpowers/specs/2026-05-17-portfolio-improvements-design.md`
**Plan:** `docs/superpowers/plans/2026-05-17-portfolio-improvements.md`
**Branch:** master (direct commits, per user preference)

## Status: 8 of 17 tasks complete (backend done, client pending)

All server-side changes are merged. The portfolio API now returns native-currency prices, comments, and `latest_valuation`; transactions accept `price_native`; unknown cryptos auto-resolve via CoinGecko search; PATCH endpoints exist for assets, transactions, and (still TODO) flat-valuations. **No client changes have been made yet** — the dashboard still shows USD only and has no Modify button, filters, or sortable columns.

Full server test suite: **87/87 passing.**

---

## ✅ Done (Tasks 1–8)

| # | Task | Commit | Notes |
|---|------|--------|-------|
| 1 | DB migrations: `assets.currency`, `assets.comment`, `transactions.price_native`, `fx_rates_cache`, `crypto_id_map` | `8039157` | Additive, idempotent |
| 2 | `fxService.js` — USD rate lookup with 1h cache, falls back to stale on failure, handles GBp | `52fd9dd` | Uses `open.er-api.com` (no API key) |
| 3 | `yahooFinance.js` returns `{price, currency}` with 22-suffix fallback table | `97f6c54` | Yahoo `meta.currency` preferred, suffix-table fallback, USD default |
| 4 | `priceService.js` propagates currency + native price; uses `fxService` | `22d2e0f` + `612a9de` | Fix in 612a9de: preserve fresh native price when FX fails |
| 5 | `coinGecko.js` auto-resolves unknown symbols via `/search` with `crypto_id_map` cache + 24h negative cache | `348bc5c` | PEPE, SAND, SEI, STRK now resolvable |
| 6 | Portfolio endpoint enriches payload with `currency`, `current_price_native`, `avg_buy_price_native`, `comment`, `latest_valuation` | `1c0dc8d` | Backward-compatible — falls back to `price_usd` for legacy rows |
| 7 | `PATCH /api/assets/:id` (partial name/comment/currency); POST seeds currency from symbol + fire-and-forget Yahoo refine | `d69b982` | Mock pattern: top-level `vi.mock` in tests |
| 8 | POST `/api/transactions` accepts `price_native` (FX-converts to USD); new `PATCH /api/transactions/:id` | `9cef491` | Mock pattern: `vi.spyOn(fxService, 'getUsdRate')` |

**Note on test mocking patterns** — Two patterns work in this CJS + Vitest setup, document for future contributors:
- **Top-level `vi.mock(path, factory)`** — works when production code imports the module *as an object* (e.g. `const yahooFinance = require('./yahooFinance'); yahooFinance.fetchStockPrices(...)`). Vitest hoists `vi.mock` and replaces the entire export.
- **`vi.spyOn(module, 'method')` in `beforeEach`** — works when production code destructures (e.g. `const { getUsdRate } = require('./fxService')`). The spy patches the live module object property.
- ❌ `vi.mock` **inside** `beforeAll`/`beforeEach` does NOT hoist correctly — leaks to real network.

---

## ⏳ Not done (Tasks 9–17)

### Task 9 — Flat valuations PATCH endpoint *(server, ~10 min)*
File: `server/routes/flatValuations.js`. Add `PATCH /api/flat-valuations/:id` accepting `{value_usd, date}` with validation. Add tests. Required by the Modify modal for flat/other assets (Task 14).

### Task 10 — Client API helpers *(~5 min)*
File: `client/src/api.js`. Add `patchAsset(id, data)`, `updateTransaction(id, data)`, `updateValuation(id, data)`.

### Task 11 — Currency-aware format helper *(~5 min)*
Create `client/src/format.js` with `formatNative(value, currency)` and `formatUsd(value)`. Handles USD, HKD, JPY, GBp/GBP, EUR, CNY, KRW, INR + fallback.

### Task 12 — FilterBar component *(~15 min)*
Create `client/src/components/FilterBar.jsx` — toggle chips for stock/crypto/flat/other.

### Task 13 — AssetTable rewrite *(~30 min, biggest UI piece)*
Rewrite `client/src/components/AssetTable.jsx` to:
- Render Avg Buy / Current Price in native currency via `formatNative`
- Show 💬 icon next to name when `asset.comment` exists (tooltip via `title`)
- Apply `filterTypes` filter and `sort` props
- Make column headers clickable to sort (asc → desc → none)
- Replace deleted Edit button with new Modify button
- Group rendering preserved

### Task 14 — ModifyAssetModal *(~20 min)*
Create `client/src/components/ModifyAssetModal.jsx`:
- Edits name, comment, latest transaction's qty + price (in native currency)
- For flat/other: edits latest valuation's `value_usd` (uses `asset.latest_valuation` from portfolio payload)
- Fetches latest tx via `api.getTransactions(asset.id)` (sorted DESC, take first)
- Delete the old `EditAssetModal.jsx`

### Task 15 — DashboardPage wiring *(~10 min)*
Update `client/src/pages/DashboardPage.jsx`:
- Add `filterTypes` state (default all 4 types)
- Add `sort` state with `handleSortChange` cycling asc → desc → none
- Mount `FilterBar` between SummaryBar and AssetTable
- Swap `EditAssetModal` import → `ModifyAssetModal`
- Pass new props to AssetTable

### Task 16 — AddAssetModal label tweak *(~5 min)*
`client/src/components/AddAssetModal.jsx`: relabel "Price per unit (USD)" → "Price per unit"; add small hint for stock type explaining currency auto-detection from symbol suffix.

### Task 17 — Manual verification *(~15 min)*
Start dev servers, exercise all 6 features in browser:
1. Add `0700.HK` — verify Avg Buy shows `HK$`, Value shows `$`
2. Add `PEPE` — verify price resolves
3. Toggle filter chips
4. Click column headers to sort
5. Add a comment via Modify, verify 💬 icon
6. Modify a transaction's qty/price, verify portfolio reflects change

---

## Pre-existing issues observed but not fixed

- **`server/tests/priceService.test.js` had `vi.mock` inside `beforeAll`** — mock didn't intercept, tests silently called real Yahoo. Fixed during Task 4 (`612a9de`).
- **`server/tests/transactions.test.js` had similar mock-hoisting bug** when Task 8 first attempted to add fxService mock — fixed mid-task with `vi.spyOn` pattern.

If you write new server tests later, copy the pattern from `tests/fxService.test.js` or `tests/transactions.test.js` (post-Task-8).

---

## How to resume

In a fresh session, run:

```
read F:/PROJECTS/profolio_viewer/docs/superpowers/plans/2026-05-17-portfolio-improvements-PROGRESS.md
read F:/PROJECTS/profolio_viewer/docs/superpowers/plans/2026-05-17-portfolio-improvements.md
```

The plan file has full code for every remaining task. Resume from **Task 9** using the subagent-driven-development workflow (your memory preference). All commits go directly to master.
