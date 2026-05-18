# Portfolio Improvements — Progress Tracker

**Last updated:** 2026-05-18
**Spec:** `docs/superpowers/specs/2026-05-17-portfolio-improvements-design.md`
**Plan:** `docs/superpowers/plans/2026-05-17-portfolio-improvements.md`
**Branch:** master (direct commits, per user preference)

## Status: 16 of 17 tasks complete — only manual verification (Task 17) remains

All server + client code changes are merged to master. Server tests: **92/92 passing**. Client production build: **success** (478 KB, 156 KB gzipped). The dashboard now shows native-currency prices, type filter chips, sortable columns, comment icons, and a Modify button. CoinGecko auto-resolves unknown crypto symbols. Only Task 17 (browser smoke test) is outstanding.

---

## ✅ Done (Tasks 1–16)

### Server (Tasks 1–9)

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
| 9 | `PATCH /api/flat-valuations/:id` with partial value_usd/date updates | `20dd1b8` | New test file `tests/flatValuations.test.js` (5 tests) |

### Client (Tasks 10–16)

| # | Task | Commit | Notes |
|---|------|--------|-------|
| 10 | `client/src/api.js` — `patchAsset`, `updateTransaction`, `updateValuation` helpers | `c606985` | 3 new methods |
| 11 | `client/src/format.js` — `formatNative(value, currency)` + `formatUsd(value)` | `0b83607` | Handles USD/HKD/JPY/GBp/GBP/EUR/CNY/KRW/INR + fallback |
| 12 | `client/src/components/FilterBar.jsx` — toggle chips for stock/crypto/flat/other | `7d082bb` | "0 selected — showing all" hint |
| 13 | `AssetTable.jsx` rewrite — currency rendering, comment icon, filterTypes, sortable headers, Modify button | `79fff17` | Group rendering preserved; sort cycles asc → desc → none |
| 14 | `ModifyAssetModal.jsx` (replaces `EditAssetModal.jsx`) — edits name/comment + latest tx (qty/price_native) OR latest valuation | `34c1ad5` | Fetches latest tx via `api.getTransactions(asset.id)[0]` |
| 15 | `DashboardPage.jsx` wiring — `filterTypes` state, `sort` state, FilterBar mount, ModifyAssetModal swap | `c471208` | Excel export now includes Currency + Price (Native) columns |
| 16 | `AddAssetModal.jsx` label tweak — "Price per unit" + currency-hint for stock type | `cf59c66` | Hint: "For non-US stocks, enter the price in the local currency..." |

**Note on test mocking patterns** (kept for future contributors):
- **Top-level `vi.mock(path, factory)`** — for code that imports modules as objects (e.g. `const yahooFinance = require('./yahooFinance'); yahooFinance.fetchStockPrices(...)`)
- **`vi.spyOn(module, 'method')` in `beforeEach`** — for code that destructures (e.g. `const { getUsdRate } = require('./fxService')`)
- ❌ `vi.mock` **inside** `beforeAll`/`beforeEach` does NOT hoist — silently leaks to real network

---

## ⏳ Not done (Task 17 only)

### Task 17 — Manual verification *(user-facing, ~15 min)*

Start dev servers and exercise all 6 features in the browser:

```
cd server && npm run dev
cd client && npm run dev   # in a second terminal
```

1. **Foreign currency** — Add `0700.HK` (Tencent), name "Tencent", qty 100, price 320. After refresh, Avg Buy should show `HK$320.00`, Value column shows `$`. Add `7203.T` (Toyota), verify `¥` with no decimals.
2. **Crypto auto-resolve** — Add `PEPE`. Current price should populate (not `—`). Try `SAND`, `SEI`, `STRK`.
3. **Filter chips** — Toggle each chip; verify rows hide/show; "0 selected — showing all" hint when all off.
4. **Sortable headers** — Click "Value" → asc arrow → click again → desc → click third time → returns to default. Repeat with "P&L".
5. **Comment** — Click Modify on any asset, add a comment, save. 💬 icon should appear next to the name; tooltip shows on hover.
6. **Modify button** — Change name and quantity, save. After refresh, both changes should stick.

If issues are found, fix them and commit.

---

## Pre-existing issues observed but not fixed

- **`server/tests/priceService.test.js` had `vi.mock` inside `beforeAll`** — silently called real Yahoo. Fixed during Task 4 (`612a9de`).
- **`server/tests/transactions.test.js` had similar mock-hoisting bug** when Task 8 first attempted to add fxService mock — fixed mid-task with `vi.spyOn` pattern.
- **Untracked test scratch files** in `server/` (`test-output.txt`, `test_fx_fail.js`, `test_spec_check.js`) and `.superpowers/` — not committed, can be cleaned up at user's discretion.

---

## Verification summary (post Task 16)

- Server: `cd server && npx vitest run` → **92/92 passing** in 2.23s (11 test files)
- Client: `cd client && npx vite build` → **success**, 47 modules, 478 KB / 156 KB gzipped
