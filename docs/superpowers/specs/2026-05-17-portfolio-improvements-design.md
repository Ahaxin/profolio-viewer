# Portfolio Viewer Improvements — Design

**Date:** 2026-05-17
**Status:** Approved (awaiting implementation plan)

## Summary

Six independent improvements to the portfolio viewer:

1. Foreign-currency display for non-US stocks (native for prices, USD for value/P&L)
2. Type filter chips above the asset table
3. Sortable columns
4. Auto-resolve missing crypto symbols (PEPE, SAND, SEI, STRK, etc.)
5. Per-asset comment field
6. "Modify" button to edit name / comment / latest transaction's price & qty

## Goals & Non-Goals

**Goals**
- Stocks listed on non-US exchanges show their native-currency price for Avg Buy / Current Price; Value and P&L remain in USD.
- Filter the asset table by type with multi-select chips; sort by any column.
- New crypto tickers auto-resolve via CoinGecko search instead of failing silently.
- A comment can be attached to each asset and viewed via hover in the table.
- A "Modify" button on each asset row lets the user fix name, comment, and the most recent transaction's qty/price without navigating to Transaction History.

**Non-Goals**
- Retroactive currency correction for assets already entered as USD. Existing rows stay flagged `USD`; user can re-add if they want native pricing.
- Editing arbitrary historical transactions from the dashboard — that remains in the Transaction History page.
- FX rates for crypto (crypto is always priced in USD by CoinGecko).
- Multi-currency display preferences (everything non-USD shows in its own native currency; the user does not pick a single "display currency").

---

## Architecture

### Data model changes (additive migrations)

```sql
-- assets table: native currency + comment
ALTER TABLE assets ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE assets ADD COLUMN comment TEXT;

-- transactions table: native-currency price (price_usd retained as authoritative cost basis)
ALTER TABLE transactions ADD COLUMN price_native REAL;

-- FX rate cache (USD-base; rate_usd = how many USD per 1 unit of currency)
CREATE TABLE IF NOT EXISTS fx_rates_cache (
  currency TEXT PRIMARY KEY,
  rate_usd REAL NOT NULL,
  updated_at DATETIME NOT NULL
);

-- Crypto ID resolution cache
CREATE TABLE IF NOT EXISTS crypto_id_map (
  symbol TEXT PRIMARY KEY,             -- uppercase
  coin_gecko_id TEXT,                  -- NULL = negative cache
  resolved_at DATETIME NOT NULL
);
```

Migrations live in `server/db/migrations.js` and are additive (check `PRAGMA table_info` before `ALTER`). Existing rows: `currency` defaults to `'USD'`, `comment` stays `NULL`, `price_native` stays `NULL` (display falls back to `price_usd`).

### New services

**`server/services/fxService.js`**
- `getUsdRate(currency)` → number (USD per 1 unit; `1.0` for USD)
- Caches in `fx_rates_cache`. Refresh threshold: 1 hour.
- Source: `https://open.er-api.com/v6/latest/USD` (free, no API key). Returns `{ rates: { HKD: 7.79, JPY: 156.2, ... } }`. We invert to get USD-per-unit and persist.
- On fetch failure: return last cached rate even if stale; if no cache exists, throw — caller treats as "FX unavailable" and shows `—` for USD value.
- `getUsdRates(currencies[])` for batch use in portfolio endpoint.

**Currency detection (in `server/services/yahooFinance.js`)**
- Yahoo's `/v8/finance/chart` response already includes `meta.currency`. Extend `fetchChart` to return `{ price, currency }`.
- `fetchStockPrices(symbols)` now returns `{ SYMBOL: { price, currency } }` instead of `{ SYMBOL: price }`.
- Suffix-based fallback table (when Yahoo doesn't return currency): `.HK→HKD`, `.T→JPY`, `.L→GBp`, `.SS→CNY`, `.SZ→CNY`, `.TO→CAD`, `.AX→AUD`, `.PA→EUR`, `.DE→EUR`, `.SW→CHF`, `.KS→KRW`. No suffix → `USD`.
- Note: Yahoo reports London prices as `GBp` (pence). We keep the unit as-is for display ("£0.85" via dividing by 100 OR show "85p"). **Decision: show as native unit Yahoo returns** — if it says `GBp` we show "GBp" prefix. Keeps math simple; FX rate for `GBp` = `GBP rate / 100`.

**Updated `server/services/coinGecko.js`**
- `fetchCryptoPrices(symbols, db)` — now takes db handle.
- Resolution order per symbol:
  1. Hardcoded `TICKER_TO_ID` map (kept for hot path)
  2. `crypto_id_map` table (skip if `coin_gecko_id IS NULL` and `resolved_at` < 24h ago)
  3. `GET /api/v3/search?query=<symbol>` → first `coins[]` entry whose `symbol` equals query case-insensitively → insert into map
  4. If nothing matched: insert `(symbol, NULL, now)` to negative-cache for 24h
- One search call per unknown symbol per session, rate-limited by negative cache.

### Server endpoint changes

**`GET /api/portfolio`** (`server/routes/portfolio.js`)

Per stock/crypto asset, enrich payload with:
- `currency` (from assets.currency)
- `avg_buy_price_native` — weighted average of `price_native` (falls back to `price_usd` for legacy rows where `price_native IS NULL`)
- `current_price_native` — from Yahoo chart (raw)
- `current_price` (USD) — `current_price_native × fx_rate` (existing field, now derived)
- `current_value` (USD) — `current_price × net_quantity` (existing)
- `pnl_usd` / `pnl_pct` — unchanged math (uses USD cost basis from `price_usd`)
- `comment`

For crypto: `currency` is always `USD`, `price_native = price_usd`.

For flat/other: unchanged.

**`POST /api/transactions`** (`server/routes/transactions.js`)

When adding a transaction for a non-USD asset:
- Request body: `{ asset_id, action, quantity, price_native, date, remarks? }`
- Server fetches current FX rate, computes `price_usd = price_native × rate`
- Stores both

For USD assets and crypto: accepts either `price_usd` or `price_native` (they're equal); stores both equal.

**`POST /api/assets`** (`server/routes/assets.js`)

For type=stock: after creating the asset, fire-and-forget call to detect currency (via Yahoo chart) and `UPDATE assets SET currency = ? WHERE id = ?`. If detection fails, leaves as `USD`. This is non-blocking — the response returns immediately with `currency: 'USD'`, and the next portfolio refresh will reflect the corrected value.

**`PATCH /api/assets/:id`** — extend to accept `comment`. `name` and `type` already supported.

**`PATCH /api/transactions/:id`** — new or extend existing: accept `{ quantity, price_native }`. Server recomputes `price_usd` from current FX (since we don't know the historical FX rate to correctly "fix" an old transaction — and the Modify modal targets the latest transaction, so "now" is a reasonable proxy).

**`PATCH /api/flat-valuations/:id`** — new: accept `{ value_usd, date? }`. Used by Modify modal for flat/other assets to edit the latest valuation.

### Client changes

**`AssetTable.jsx`**

New props: `filterTypes: Set<string>`, `sort: {col, dir}`, `onSortChange(col)`.

- Filter: apply `assets.filter(a => filterTypes.has(a.type))` before grouping. Empty set → no filter.
- Sort: sort `grouped[]` by the chosen column on aggregate values. Direction toggles `asc → desc → none` (none restores `created_at ASC`). Active column gets an arrow indicator (`▲` / `▼`) in the header.
- Each `<th>` becomes a `<button>` (or styled span with `role="button"`) with onClick → onSortChange.
- Name cell: if `asset.comment` is non-empty, render a small 💬 next to the name with `title={asset.comment}` for tooltip. Group rows show 💬 if any item in the group has a comment (tooltip lists each).
- Avg Buy and Current Price columns: show with currency-aware format helper `formatNative(price, currency)`:
  - USD → `$1,234.56`
  - HKD → `HK$1,234.56`
  - JPY → `¥1,235` (no decimals)
  - GBp → `85.0p`
  - CNY → `¥1,234.56` (or `CN¥` to disambiguate from JPY)
  - Other → `<CODE> 1,234.56` (e.g., `EUR 1,234.56`)
- "Actions" column: replace nothing → add **Modify** button next to Del. For flat/other, +Val is replaced by Modify (still shows in the modal).

**`DashboardPage.jsx`**
- State: `filterTypes` (default `new Set(['stock','crypto','flat','other'])`), `sort` (default `{col: null, dir: null}`).
- New toolbar component `<FilterBar />` above `<SummaryBar />` or between SummaryBar and AssetTable, with four toggle chips.
- Pass props down to AssetTable.

**`ModifyAssetModal.jsx`** (replaces `EditAssetModal.jsx`)
- Renders:
  - Always: Name, Comment (textarea)
  - stock/crypto: read-only latest transaction date + editable Quantity, Price (with currency suffix label, e.g., "Price (HKD)"); helper text "Edits the most recent transaction. For older transactions, use Transaction History."
  - flat/other: read-only latest valuation date + editable Value (USD); same helper note pointing to the asset detail page for historical valuations.
- Calls (in order, awaited):
  1. `PATCH /api/assets/:id` with `{ name, comment }`
  2. `PATCH /api/transactions/:id` with `{ quantity, price_native }` (or `PATCH /api/flat-valuations/:id` with `{ value_usd }`)
- On success, calls `onSuccess()` which refreshes the dashboard.

**`AddAssetModal.jsx`** + **`AddValuationModal.jsx`** (light tweaks)
- When type=stock or crypto: rename "Price per unit (USD)" → "Price per unit". For stocks, after the asset is created the page reload picks up the detected currency; for the *initial* transaction, the user has no way to know the currency before submit. **Decision:** initial transaction submits price as-is and treats it as USD; if Yahoo later reports a non-USD currency, the user can fix via Modify. (Alternative: detect currency on symbol blur via a `GET /api/lookup?symbol=` endpoint. Out of scope for v1; add later if friction is real.)

### Format helper

```js
// client/src/format.js
export function formatNative(value, currency) {
  if (value == null) return '—';
  switch (currency) {
    case 'USD': return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'HKD': return `HK$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'JPY': return `¥${Math.round(value).toLocaleString('en-US')}`;
    case 'GBp': return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}p`;
    case 'GBP': return `£${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'EUR': return `€${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'CNY': return `CN¥${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:    return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
```

---

## Error Handling

- **FX fetch fails on portfolio load:** USD value/P&L for affected non-USD assets show `—` with a stale ⚠ indicator on the price cell. Native price still renders.
- **FX fetch fails on transaction add (non-USD asset):** return 503 with `{ error: 'FX rate unavailable, try again' }`; client shows error in modal.
- **CoinGecko search fails (network):** log, treat symbol as unresolved this cycle (no negative cache insert — we want to retry next refresh). User sees `—` for current price with stale ⚠.
- **CoinGecko search returns no match:** negative-cache for 24h. User sees `—`.
- **Yahoo doesn't return currency:** fall back to suffix table, else `USD`.
- **PATCH on a transaction whose asset_id mismatches user:** 403 (existing auth pattern).

---

## Testing

Server (Vitest, existing setup):
- `fxService.test.js` — caching, staleness threshold, fallback to stale on fetch fail.
- `coinGecko.test.js` — hardcoded hit, cache hit, search resolution, negative cache, expiry of negative cache.
- `yahooFinance.test.js` — extended for `{ price, currency }` return shape and suffix fallback.
- `transactions.test.js` — PATCH endpoint, price_native + recomputed price_usd.
- `assets.test.js` — PATCH endpoint with comment, currency auto-detection on add.
- `portfolio.test.js` — enriched payload includes `currency`, `avg_buy_price_native`, `current_price_native`, `comment`.
- `migrations.test.js` — new columns added idempotently; legacy rows default correctly.

Client (manual, no test suite currently):
- Add a non-US stock (e.g., `0700.HK`); verify currency detected and prices show in HKD, value in USD.
- Add a crypto (e.g., `PEPE`); verify auto-resolution and price shown.
- Toggle filter chips; verify table updates.
- Click column headers; verify sort cycles asc → desc → none with arrow indicators.
- Add a comment via Modify; verify 💬 icon and tooltip.
- Modify a transaction's qty/price; verify portfolio reflects change.

---

## Open Risks & Mitigations

- **`open.er-api.com` availability.** Free tier, no SLA. Mitigation: cache for 1h, serve stale on failure. If becomes a real problem, swap to `exchangerate.host` or paid Fixer.io behind same `fxService` interface.
- **CoinGecko `/search` rate limits.** Free tier is ~30 calls/min. Resolution is one call per *unknown* symbol per 24h thanks to negative cache; portfolio with <50 unique cryptos should never hit this.
- **GBp pence display.** Yahoo returns London prices in pence. FX rate for `GBp` = `GBP / 100`. Helper handles this explicitly.
- **Currency detection async race.** The asset add returns before Yahoo lookup completes. The first portfolio fetch after add may still show `USD`; the next one reflects the corrected currency. Acceptable for v1.
