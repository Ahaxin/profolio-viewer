# Portfolio Viewer Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add foreign-currency stock display, type filters, sortable columns, auto-resolved crypto symbols, per-asset comments, and a Modify button.

**Architecture:** Additive SQLite migrations add `assets.currency`, `assets.comment`, `transactions.price_native`, and two cache tables (`fx_rates_cache`, `crypto_id_map`). A new `fxService` provides USD conversion rates; `yahooFinance` is refactored to return currency alongside price; `coinGecko` resolves unknown symbols via search. Server enriches the portfolio payload with native-currency fields; the React client adds filter chips, sortable headers, a comment icon, and a Modify modal that edits the asset metadata plus the latest transaction.

**Tech Stack:** Node.js + Express + better-sqlite3 + Vitest on server; React + Vite on client. Free FX API: `open.er-api.com` (no key). CoinGecko `/search` for crypto resolution.

**Source spec:** `docs/superpowers/specs/2026-05-17-portfolio-improvements-design.md`

---

## File Map

**Server**
- Modify `server/db/migrations.js` — add new columns + tables
- Create `server/services/fxService.js` — FX rate lookup with cache + fallback
- Modify `server/services/yahooFinance.js` — return `{price, currency}`; suffix fallback
- Modify `server/services/coinGecko.js` — search-based auto-resolve with cache table
- Modify `server/services/priceService.js` — propagate currency through the result map
- Modify `server/routes/portfolio.js` — enrich payload with native fields, FX-derived USD value, comment
- Modify `server/routes/assets.js` — PATCH endpoint accepting partial updates incl. `comment`; async currency detection on POST
- Modify `server/routes/transactions.js` — POST accepts `price_native`; PATCH endpoint
- Modify `server/routes/flatValuations.js` — PATCH endpoint
- New tests: `server/tests/fxService.test.js`, `server/tests/cryptoResolve.test.js`
- Extend tests: `server/tests/migrations.test.js`, `server/tests/yahooFinance.test.js` (if absent, create), `server/tests/portfolio.test.js`, `server/tests/assets.test.js`, `server/tests/transactions.test.js`, `server/tests/priceService.test.js`

**Client**
- Modify `client/src/api.js` — add `patchAsset`, `updateTransaction`, `updateValuation`
- Create `client/src/format.js` — currency-aware price formatter
- Modify `client/src/components/AssetTable.jsx` — currency rendering, comment icon, filter+sort awareness
- Modify `client/src/pages/DashboardPage.jsx` — filter/sort state, FilterBar toolbar
- Create `client/src/components/FilterBar.jsx` — toggle chips for type filter
- Delete `client/src/components/EditAssetModal.jsx`; create `client/src/components/ModifyAssetModal.jsx`
- Modify `client/src/components/AddAssetModal.jsx` — relabel price field
- Modify `client/src/components/AddValuationModal.jsx` — no change beyond what is mentioned (read for context)

---

## Task 1: Database migrations

**Files:**
- Modify: `server/db/migrations.js`
- Test: `server/tests/migrations.test.js`

- [ ] **Step 1: Write failing test for new schema**

Open `server/tests/migrations.test.js` and read the existing tests for style. Append these test cases inside the existing `describe` block (or create the file if needed — pattern from existing tests below):

```js
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

describe('migrations — portfolio improvements', () => {
  it('adds currency column to assets defaulting to USD', () => {
    const db = createTestDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(assets)").all();
    const currency = cols.find(c => c.name === 'currency');
    expect(currency).toBeDefined();
    expect(currency.dflt_value).toBe("'USD'");
    expect(currency.notnull).toBe(1);
  });

  it('adds comment column to assets (nullable)', () => {
    const db = createTestDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(assets)").all();
    expect(cols.some(c => c.name === 'comment')).toBe(true);
  });

  it('adds price_native column to transactions (nullable)', () => {
    const db = createTestDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(transactions)").all();
    expect(cols.some(c => c.name === 'price_native')).toBe(true);
  });

  it('creates fx_rates_cache table', () => {
    const db = createTestDb();
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fx_rates_cache'").get();
    expect(row).toBeDefined();
  });

  it('creates crypto_id_map table', () => {
    const db = createTestDb();
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='crypto_id_map'").get();
    expect(row).toBeDefined();
  });

  it('is idempotent (running twice does not fail)', () => {
    const db = createTestDb();
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/migrations.test.js`
Expected: FAIL — new columns/tables don't exist yet.

- [ ] **Step 3: Update `server/db/migrations.js`**

Replace the file contents with:

```js
function runMigrations(db) {
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('stock','crypto','flat','other')),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('buy','sell')),
      quantity REAL NOT NULL,
      price_usd REAL NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prices_cache (
      symbol TEXT PRIMARY KEY,
      price_usd REAL,
      updated_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flat_valuations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      value_usd REAL NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fx_rates_cache (
      currency TEXT PRIMARY KEY,
      rate_usd REAL NOT NULL,
      updated_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crypto_id_map (
      symbol TEXT PRIMARY KEY,
      coin_gecko_id TEXT,
      resolved_at DATETIME NOT NULL
    );
  `);

  // Additive migration: remarks column on transactions
  const txCols = db.prepare("PRAGMA table_info(transactions)").all();
  if (!txCols.some(c => c.name === 'remarks')) {
    db.exec("ALTER TABLE transactions ADD COLUMN remarks TEXT");
  }
  if (!txCols.some(c => c.name === 'price_native')) {
    db.exec("ALTER TABLE transactions ADD COLUMN price_native REAL");
  }

  // Additive migration: currency + comment columns on assets
  const assetCols = db.prepare("PRAGMA table_info(assets)").all();
  if (!assetCols.some(c => c.name === 'currency')) {
    db.exec("ALTER TABLE assets ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  }
  if (!assetCols.some(c => c.name === 'comment')) {
    db.exec("ALTER TABLE assets ADD COLUMN comment TEXT");
  }
}

module.exports = { runMigrations };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && npx vitest run tests/migrations.test.js`
Expected: PASS for all migrations tests.

Then run the full suite to make sure nothing else broke:
Run: `cd server && npx vitest run`
Expected: All previously-green tests still PASS. (Some downstream tests may fail because the portfolio shape changes later — they should still pass at this point because migrations are additive.)

- [ ] **Step 5: Commit**

```bash
git add server/db/migrations.js server/tests/migrations.test.js
git commit -m "feat(db): add currency, comment, price_native, fx + crypto map tables"
```

---

## Task 2: FX rate service

**Files:**
- Create: `server/services/fxService.js`
- Create: `server/tests/fxService.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/fxService.test.js`:

```js
const axios = require('axios');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

let fxService;

beforeAll(async () => {
  vi.mock('axios');
  fxService = await import('../services/fxService');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fxService.getUsdRate', () => {
  it('returns 1 for USD without DB hit', async () => {
    const db = createTestDb();
    runMigrations(db);
    const rate = await fxService.getUsdRate(db, 'USD');
    expect(rate).toBe(1);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('returns cached rate if fresh (< 1h old)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const freshTime = new Date(Date.now() - 5 * 60_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.128, freshTime);

    const rate = await fxService.getUsdRate(db, 'HKD');
    expect(rate).toBe(0.128);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('fetches fresh rates when cache is stale (> 1h)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const staleTime = new Date(Date.now() - 2 * 3600_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.10, staleTime);

    axios.get.mockResolvedValue({
      data: { result: 'success', rates: { HKD: 7.80, JPY: 156.0, GBP: 0.79 } },
    });

    const rate = await fxService.getUsdRate(db, 'HKD');
    // open.er-api returns "rates from USD" so 1 USD = 7.80 HKD → 1 HKD = 1/7.80 ≈ 0.1282
    expect(rate).toBeCloseTo(1 / 7.80, 6);
  });

  it('falls back to stale cache when fetch fails', async () => {
    const db = createTestDb();
    runMigrations(db);
    const staleTime = new Date(Date.now() - 2 * 3600_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.10, staleTime);

    axios.get.mockRejectedValue(new Error('network error'));
    const rate = await fxService.getUsdRate(db, 'HKD');
    expect(rate).toBe(0.10);
  });

  it('throws when no cache exists and fetch fails', async () => {
    const db = createTestDb();
    runMigrations(db);
    axios.get.mockRejectedValue(new Error('network error'));
    await expect(fxService.getUsdRate(db, 'HKD')).rejects.toThrow();
  });

  it('handles GBp (pence) as GBP / 100', async () => {
    const db = createTestDb();
    runMigrations(db);
    axios.get.mockResolvedValue({
      data: { result: 'success', rates: { GBP: 0.79 } },
    });
    const rate = await fxService.getUsdRate(db, 'GBp');
    // 1 GBP = 1/0.79 USD; 1 GBp = (1/0.79) / 100
    expect(rate).toBeCloseTo((1 / 0.79) / 100, 8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/fxService.test.js`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `server/services/fxService.js`**

```js
const axios = require('axios');

const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get USD value of 1 unit of `currency`.
 * Example: getUsdRate(db, 'HKD') → 0.128 (i.e. 1 HKD = $0.128).
 * Returns 1 for USD without any DB or network call.
 * Returns stale cached value if fetch fails. Throws if no cache and fetch fails.
 *
 * Special-cases 'GBp' (London pence) as GBP / 100.
 */
async function getUsdRate(db, currency) {
  if (currency === 'USD') return 1;

  const lookupCurrency = currency === 'GBp' ? 'GBP' : currency;
  const cached = db.prepare('SELECT rate_usd, updated_at FROM fx_rates_cache WHERE currency = ?').get(lookupCurrency);
  const now = Date.now();
  const isFresh = cached && (now - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS;

  if (isFresh) {
    return currency === 'GBp' ? cached.rate_usd / 100 : cached.rate_usd;
  }

  try {
    const res = await axios.get(FX_API_URL, { timeout: 10000 });
    const rates = res.data && res.data.rates;
    if (!rates || res.data.result !== 'success') {
      throw new Error('FX API returned no rates');
    }
    const updatedAt = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(currency) DO UPDATE SET rate_usd = excluded.rate_usd, updated_at = excluded.updated_at
    `);
    for (const [code, perUsd] of Object.entries(rates)) {
      // open.er-api returns "how many <code> per 1 USD" → invert to "how many USD per 1 <code>"
      if (perUsd > 0) upsert.run(code, 1 / perUsd, updatedAt);
    }
    const refreshed = db.prepare('SELECT rate_usd FROM fx_rates_cache WHERE currency = ?').get(lookupCurrency);
    if (!refreshed) throw new Error(`Unknown currency: ${currency}`);
    return currency === 'GBp' ? refreshed.rate_usd / 100 : refreshed.rate_usd;
  } catch (err) {
    if (cached) {
      console.warn(`[fxService] using stale rate for ${currency}: ${err.message}`);
      return currency === 'GBp' ? cached.rate_usd / 100 : cached.rate_usd;
    }
    throw new Error(`FX rate unavailable for ${currency}: ${err.message}`);
  }
}

/**
 * Batch helper: returns map { currency: rate_usd } for unique currencies.
 * One fetch per call (the first non-USD missing rate triggers refresh of all).
 */
async function getUsdRates(db, currencies) {
  const result = {};
  for (const c of new Set(currencies)) {
    try {
      result[c] = await getUsdRate(db, c);
    } catch (err) {
      console.warn(`[fxService] cannot resolve ${c}: ${err.message}`);
      result[c] = null;
    }
  }
  return result;
}

module.exports = { getUsdRate, getUsdRates };
```

- [ ] **Step 4: Run test to verify pass**

Run: `cd server && npx vitest run tests/fxService.test.js`
Expected: PASS for all 6 cases.

- [ ] **Step 5: Commit**

```bash
git add server/services/fxService.js server/tests/fxService.test.js
git commit -m "feat(server): add fxService for USD rate lookup with caching"
```

---

## Task 3: Yahoo Finance returns currency

**Files:**
- Modify: `server/services/yahooFinance.js`
- Test: `server/tests/yahooFinance.test.js` (create if absent — check first)

- [ ] **Step 1: Check whether a test file exists**

Run: `ls server/tests/yahooFinance.test.js 2>/dev/null || echo "absent"`

If absent, create it. If present, read it and adapt the new tests below into its style.

- [ ] **Step 2: Write failing test**

Create or append to `server/tests/yahooFinance.test.js`:

```js
const axios = require('axios');

let fetchStockPrices;

beforeAll(async () => {
  vi.mock('axios');
  ({ fetchStockPrices } = await import('../services/yahooFinance'));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchStockPrices', () => {
  it('returns {price, currency} from chart meta', async () => {
    axios.get.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 192.5, currency: 'USD' } }] } },
    });
    const res = await fetchStockPrices(['AAPL']);
    expect(res.AAPL).toEqual({ price: 192.5, currency: 'USD' });
  });

  it('detects HKD for .HK suffix when meta.currency missing', async () => {
    axios.get.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 320 } }] } },
    });
    const res = await fetchStockPrices(['0700.HK']);
    expect(res['0700.HK']).toEqual({ price: 320, currency: 'HKD' });
  });

  it('uses suffix table for JP/UK/EU when meta.currency missing', async () => {
    axios.get.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 1000 } }] } },
    });
    const res = await fetchStockPrices(['7203.T']);
    expect(res['7203.T'].currency).toBe('JPY');
  });

  it('falls back to USD when no meta.currency and no suffix match', async () => {
    axios.get.mockResolvedValue({
      data: { chart: { result: [{ meta: { regularMarketPrice: 50 } }] } },
    });
    const res = await fetchStockPrices(['SOMETHING']);
    expect(res.SOMETHING.currency).toBe('USD');
  });

  it('omits symbols with no price', async () => {
    axios.get.mockResolvedValue({
      data: { chart: { result: [{ meta: {} }] } },
    });
    const res = await fetchStockPrices(['NOPRICE']);
    expect(res.NOPRICE).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run tests/yahooFinance.test.js`
Expected: FAIL — current `fetchStockPrices` returns numeric prices, not `{price, currency}`.

- [ ] **Step 4: Refactor `server/services/yahooFinance.js`**

Replace contents:

```js
const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const SUFFIX_TO_CURRENCY = {
  HK: 'HKD',  T: 'JPY',  L: 'GBp',  SS: 'CNY',  SZ: 'CNY',
  TO: 'CAD',  AX: 'AUD', PA: 'EUR', DE: 'EUR',  AS: 'EUR',
  SW: 'CHF',  KS: 'KRW', NS: 'INR', BO: 'INR',  SI: 'SGD',
  ST: 'SEK',  OL: 'NOK', HE: 'EUR', BR: 'EUR',  MC: 'EUR',
  MI: 'EUR',  TW: 'TWD',
};

function inferCurrencyFromSymbol(symbol) {
  const dot = symbol.lastIndexOf('.');
  if (dot < 0) return 'USD';
  const suffix = symbol.slice(dot + 1).toUpperCase();
  return SUFFIX_TO_CURRENCY[suffix] || 'USD';
}

async function fetchChart(host, candidate) {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(candidate)}`;
  const res = await axios.get(url, {
    params: { interval: '1d', range: '1d' },
    headers: HEADERS,
    timeout: 10000,
  });
  const meta = res.data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (price == null) {
    console.warn(`[yahooFinance] ${host}/${candidate}: response ok but no price in payload`);
    return null;
  }
  return { price, currency: meta?.currency || null };
}

/**
 * Fetch current prices and currencies for a list of stock symbols.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, {price: number, currency: string}>>}
 */
async function fetchStockPrices(symbols) {
  if (!symbols.length) return {};

  const results = {};
  await Promise.all(symbols.map(async (symbol) => {
    const candidates = [symbol];
    if (symbol.includes('/')) {
      candidates.push(...symbol.split('/').map(s => s.trim()).filter(Boolean));
    }

    for (const candidate of [...new Set(candidates)]) {
      for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
        try {
          const chart = await fetchChart(host, candidate);
          if (chart) {
            const currency = chart.currency || inferCurrencyFromSymbol(symbol);
            results[symbol] = { price: chart.price, currency };
            return;
          }
        } catch (err) {
          console.error(`[yahooFinance] ${host}/${candidate}: ${err.message}`);
        }
      }
    }
  }));

  return results;
}

module.exports = { fetchStockPrices, inferCurrencyFromSymbol };
```

- [ ] **Step 5: Run test to verify pass**

Run: `cd server && npx vitest run tests/yahooFinance.test.js`
Expected: PASS for all 5 cases.

- [ ] **Step 6: Commit**

```bash
git add server/services/yahooFinance.js server/tests/yahooFinance.test.js
git commit -m "feat(server): yahooFinance returns {price, currency} with suffix fallback"
```

---

## Task 4: Propagate currency through priceService

**Files:**
- Modify: `server/services/priceService.js`
- Modify: `server/tests/priceService.test.js`

- [ ] **Step 1: Update existing tests to expect the new shape**

Read `server/tests/priceService.test.js`. The test file mocks `fetchStockPrices` to return `{ AAPL: 155 }`. With the new shape it should return `{ AAPL: { price: 155, currency: 'USD' } }`, and `result['AAPL']` should include a `currency` field.

Update the test file. Replace the body inside `describe('getPortfolioPrices', () => {` to:

```js
  let db;
  beforeEach(() => {
    db = createTestDb();
    runMigrations(db);
    vi.clearAllMocks();
  });

  it('returns cached price with currency if fresh (< 5 min old)', async () => {
    const freshTime = new Date(Date.now() - 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 150, freshTime);

    fetchStockPrices.mockResolvedValue({});
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock', currency: 'USD' }]);
    expect(result['AAPL'].price_usd).toBe(150);
    expect(result['AAPL'].price_native).toBe(150);
    expect(result['AAPL'].currency).toBe('USD');
    expect(result['AAPL'].stale).toBe(false);
    expect(fetchStockPrices).not.toHaveBeenCalled();
  });

  it('fetches fresh price when cache is stale and stores both USD + native', async () => {
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('0700.HK', 30, staleTime);
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.128, new Date().toISOString());

    fetchStockPrices.mockResolvedValue({ '0700.HK': { price: 320, currency: 'HKD' } });
    const result = await getPortfolioPrices(db, [{ symbol: '0700.HK', type: 'stock', currency: 'HKD' }]);
    expect(result['0700.HK'].price_native).toBe(320);
    expect(result['0700.HK'].currency).toBe('HKD');
    expect(result['0700.HK'].price_usd).toBeCloseTo(320 * 0.128, 4);
    expect(result['0700.HK'].stale).toBe(false);
  });

  it('returns stale cached price when fetch fails', async () => {
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 140, staleTime);

    fetchStockPrices.mockRejectedValue(new Error('network error'));
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock', currency: 'USD' }]);
    expect(result['AAPL'].price_usd).toBe(140);
    expect(result['AAPL'].stale).toBe(true);
  });

  it('returns null price with stale flag when no cache and fetch fails', async () => {
    fetchStockPrices.mockRejectedValue(new Error('network error'));
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock', currency: 'USD' }]);
    expect(result['AAPL'].price_usd).toBeNull();
    expect(result['AAPL'].stale).toBe(true);
  });

  it('skips price fetch for flat/other assets', async () => {
    const result = await getPortfolioPrices(db, [{ symbol: 'My Flat', type: 'flat', currency: 'USD' }]);
    expect(result['My Flat']).toBeUndefined();
    expect(fetchStockPrices).not.toHaveBeenCalled();
    expect(fetchCryptoPrices).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/priceService.test.js`
Expected: FAIL — `currency` and `price_native` fields aren't returned yet.

- [ ] **Step 3: Update `server/services/priceService.js`**

Replace contents:

```js
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const { fetchStockPrices } = require('./yahooFinance');
const { fetchCryptoPrices } = require('./coinGecko');
const { getUsdRate } = require('./fxService');

/**
 * Get prices for a list of assets, using cache where fresh.
 * @param {object} db — better-sqlite3 instance
 * @param {Array<{symbol, type, currency}>} assets
 * @returns {Promise<Record<string, {price_usd, price_native, currency, stale, updated_at}>>}
 */
async function getPortfolioPrices(db, assets) {
  const now = Date.now();
  const result = {};
  const staleStocks = [];
  const staleCrypto = [];
  const currencyBySymbol = {};

  for (const { symbol, type, currency } of assets) {
    if (type === 'flat' || type === 'other') continue;
    currencyBySymbol[symbol] = currency || 'USD';

    const cached = db.prepare('SELECT price_usd, updated_at FROM prices_cache WHERE symbol = ?').get(symbol);
    const isFresh = cached && (now - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS;

    if (isFresh) {
      const priceUsd = cached.price_usd;
      const priceNative = await usdToNative(db, priceUsd, currencyBySymbol[symbol]);
      result[symbol] = {
        price_usd: priceUsd,
        price_native: priceNative,
        currency: currencyBySymbol[symbol],
        stale: false,
        updated_at: cached.updated_at,
      };
    } else {
      if (type === 'stock') staleStocks.push(symbol);
      else if (type === 'crypto') staleCrypto.push(symbol);
      // Provide existing cache as fallback while we wait for fetch
      result[symbol] = cached
        ? {
            price_usd: cached.price_usd,
            price_native: await usdToNative(db, cached.price_usd, currencyBySymbol[symbol]),
            currency: currencyBySymbol[symbol],
            stale: true,
            updated_at: cached.updated_at,
          }
        : {
            price_usd: null,
            price_native: null,
            currency: currencyBySymbol[symbol],
            stale: true,
            updated_at: null,
          };
    }
  }

  if (staleStocks.length) {
    try {
      const fresh = await fetchStockPrices(staleStocks);
      // fresh: { SYMBOL: { price, currency } }  — `price` is native
      const usdMap = {};
      for (const [symbol, info] of Object.entries(fresh)) {
        const nativeCurrency = info.currency || currencyBySymbol[symbol] || 'USD';
        try {
          const rate = await getUsdRate(db, nativeCurrency);
          usdMap[symbol] = info.price * rate;
          result[symbol] = {
            price_usd: usdMap[symbol],
            price_native: info.price,
            currency: nativeCurrency,
            stale: false,
            updated_at: new Date().toISOString(),
          };
        } catch (err) {
          console.error(`[priceService] FX fail for ${symbol} (${nativeCurrency}): ${err.message}`);
        }
      }
      _persistUsdCache(db, usdMap);
    } catch (err) {
      console.error(`[priceService] Failed to fetch stock prices for [${staleStocks.join(', ')}]:`, err.message);
    }
  }

  if (staleCrypto.length) {
    try {
      const fresh = await fetchCryptoPrices(staleCrypto, db);
      // crypto: USD-priced; native = USD
      const usdMap = {};
      for (const [symbol, price] of Object.entries(fresh)) {
        usdMap[symbol] = price;
        result[symbol] = {
          price_usd: price,
          price_native: price,
          currency: 'USD',
          stale: false,
          updated_at: new Date().toISOString(),
        };
      }
      _persistUsdCache(db, usdMap);
    } catch (err) {
      console.error(`[priceService] Failed to fetch crypto prices for [${staleCrypto.join(', ')}]:`, err.message);
    }
  }

  return result;
}

async function usdToNative(db, priceUsd, currency) {
  if (priceUsd == null) return null;
  if (currency === 'USD') return priceUsd;
  try {
    const rate = await getUsdRate(db, currency);
    return rate > 0 ? priceUsd / rate : null;
  } catch {
    return null;
  }
}

function _persistUsdCache(db, usdMap) {
  if (!Object.keys(usdMap).length) return;
  const updatedAt = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET price_usd = excluded.price_usd, updated_at = excluded.updated_at
  `);
  for (const [symbol, priceUsd] of Object.entries(usdMap)) {
    upsert.run(symbol, priceUsd, updatedAt);
  }
}

module.exports = { getPortfolioPrices };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run tests/priceService.test.js`
Expected: PASS for all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add server/services/priceService.js server/tests/priceService.test.js
git commit -m "feat(server): priceService propagates currency and native price"
```

---

## Task 5: CoinGecko auto-resolution

**Files:**
- Modify: `server/services/coinGecko.js`
- Create: `server/tests/cryptoResolve.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/cryptoResolve.test.js`:

```js
const axios = require('axios');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

let fetchCryptoPrices;

beforeAll(async () => {
  vi.mock('axios');
  ({ fetchCryptoPrices } = await import('../services/coinGecko'));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchCryptoPrices — auto-resolve unknown symbols', () => {
  it('uses hardcoded TICKER_TO_ID map for known symbols', async () => {
    const db = createTestDb();
    runMigrations(db);
    axios.get.mockResolvedValue({ data: { bitcoin: { usd: 60000 } } });

    const res = await fetchCryptoPrices(['BTC'], db);
    expect(res.BTC).toBe(60000);
    // Should have hit /simple/price only, not /search
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('/simple/price');
  });

  it('resolves unknown symbol via /search and caches it', async () => {
    const db = createTestDb();
    runMigrations(db);
    axios.get
      .mockResolvedValueOnce({ data: { coins: [{ id: 'pepe', symbol: 'pepe', name: 'Pepe' }] } })
      .mockResolvedValueOnce({ data: { pepe: { usd: 0.0000018 } } });

    const res = await fetchCryptoPrices(['PEPE'], db);
    expect(res.PEPE).toBe(0.0000018);

    const cached = db.prepare('SELECT coin_gecko_id FROM crypto_id_map WHERE symbol = ?').get('PEPE');
    expect(cached.coin_gecko_id).toBe('pepe');
  });

  it('uses cached coin_gecko_id on second call (no /search)', async () => {
    const db = createTestDb();
    runMigrations(db);
    db.prepare('INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?,?,?)')
      .run('SAND', 'the-sandbox', new Date().toISOString());

    axios.get.mockResolvedValue({ data: { 'the-sandbox': { usd: 0.50 } } });
    const res = await fetchCryptoPrices(['SAND'], db);
    expect(res.SAND).toBe(0.50);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('/simple/price');
  });

  it('negative-caches when /search returns no match', async () => {
    const db = createTestDb();
    runMigrations(db);
    axios.get
      .mockResolvedValueOnce({ data: { coins: [] } })          // search empty
      .mockResolvedValueOnce({ data: {} });                    // price call

    const res = await fetchCryptoPrices(['ZZZZUNKNOWN'], db);
    expect(res.ZZZZUNKNOWN).toBeUndefined();

    const cached = db.prepare('SELECT coin_gecko_id FROM crypto_id_map WHERE symbol = ?').get('ZZZZUNKNOWN');
    expect(cached).toBeDefined();
    expect(cached.coin_gecko_id).toBeNull();
  });

  it('respects 24h negative cache (no /search retry)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const recentlyFailed = new Date(Date.now() - 60 * 60_000).toISOString(); // 1h ago
    db.prepare('INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?,?,?)')
      .run('GHOSTCOIN', null, recentlyFailed);

    const res = await fetchCryptoPrices(['GHOSTCOIN'], db);
    expect(res.GHOSTCOIN).toBeUndefined();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('retries /search after 24h negative cache expires', async () => {
    const db = createTestDb();
    runMigrations(db);
    const dayOld = new Date(Date.now() - 25 * 3600_000).toISOString();
    db.prepare('INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?,?,?)')
      .run('SEI', null, dayOld);

    axios.get
      .mockResolvedValueOnce({ data: { coins: [{ id: 'sei-network', symbol: 'sei' }] } })
      .mockResolvedValueOnce({ data: { 'sei-network': { usd: 0.45 } } });

    const res = await fetchCryptoPrices(['SEI'], db);
    expect(res.SEI).toBe(0.45);
  });

  it('matches symbol case-insensitively in search results', async () => {
    const db = createTestDb();
    runMigrations(db);
    axios.get
      .mockResolvedValueOnce({ data: { coins: [
        { id: 'somethingelse', symbol: 'other' },
        { id: 'starknet', symbol: 'strk' },
      ] } })
      .mockResolvedValueOnce({ data: { starknet: { usd: 1.2 } } });

    const res = await fetchCryptoPrices(['STRK'], db);
    expect(res.STRK).toBe(1.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/cryptoResolve.test.js`
Expected: FAIL — current `fetchCryptoPrices` doesn't take a `db` arg and doesn't use `/search`.

- [ ] **Step 3: Refactor `server/services/coinGecko.js`**

Replace contents:

```js
const axios = require('axios');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const TICKER_TO_ID = {
  BTC: 'bitcoin',  ETH: 'ethereum',  SOL: 'solana',  BNB: 'binancecoin',
  XRP: 'ripple',   ADA: 'cardano',   DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', MATIC: 'matic-network', LINK: 'chainlink',
  LTC: 'litecoin', UNI: 'uniswap',   ATOM: 'cosmos',  XLM: 'stellar',
};

async function resolveCoinId(symbol, db) {
  const upper = symbol.toUpperCase();
  if (TICKER_TO_ID[upper]) return TICKER_TO_ID[upper];

  const cached = db.prepare('SELECT coin_gecko_id, resolved_at FROM crypto_id_map WHERE symbol = ?').get(upper);
  if (cached) {
    const age = Date.now() - new Date(cached.resolved_at).getTime();
    if (cached.coin_gecko_id) return cached.coin_gecko_id;
    if (age < NEGATIVE_CACHE_TTL_MS) return null; // recently failed; don't retry
  }

  // /search lookup
  let coinId = null;
  try {
    const res = await axios.get(`${COINGECKO_BASE}/search`, {
      params: { query: upper },
      timeout: 10000,
    });
    const coins = res.data?.coins || [];
    const match = coins.find(c => (c.symbol || '').toUpperCase() === upper);
    coinId = match?.id || null;
  } catch (err) {
    console.warn(`[coinGecko] search failed for ${upper}: ${err.message}`);
    // Don't negative-cache transient errors — return null without writing
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET coin_gecko_id = excluded.coin_gecko_id, resolved_at = excluded.resolved_at
  `).run(upper, coinId, now);

  return coinId;
}

/**
 * Fetch current USD prices for a list of crypto symbols (e.g. ['BTC','PEPE']).
 * Resolves unknown symbols via CoinGecko /search and caches the mapping.
 * @param {string[]} symbols
 * @param {object} db — better-sqlite3 instance
 * @returns {Promise<Record<string, number>>} symbol -> price map (original case)
 */
async function fetchCryptoPrices(symbols, db) {
  if (!symbols.length) return {};

  const symbolToId = {};
  for (const symbol of symbols) {
    const id = await resolveCoinId(symbol, db);
    if (id) symbolToId[symbol] = id;
  }

  const ids = [...new Set(Object.values(symbolToId))];
  if (!ids.length) return {};

  const res = await axios.get(`${COINGECKO_BASE}/simple/price`, {
    params: { ids: ids.join(','), vs_currencies: 'usd' },
    timeout: 10000,
  });

  const results = {};
  for (const symbol of symbols) {
    const id = symbolToId[symbol];
    if (id && res.data[id]?.usd) {
      results[symbol] = res.data[id].usd;
    }
  }
  return results;
}

module.exports = { fetchCryptoPrices };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && npx vitest run tests/cryptoResolve.test.js`
Expected: PASS for all 7 cases.

Also re-run the priceService test (it now passes `db` arg implicitly through the mock):
Run: `cd server && npx vitest run tests/priceService.test.js`
Expected: still PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/coinGecko.js server/tests/cryptoResolve.test.js
git commit -m "feat(server): auto-resolve unknown crypto symbols via CoinGecko search"
```

---

## Task 6: Portfolio endpoint enrichment

**Files:**
- Modify: `server/routes/portfolio.js`
- Modify: `server/tests/portfolio.test.js`

- [ ] **Step 1: Read the existing portfolio test for context**

Run: `cat server/tests/portfolio.test.js` (or read via your tool of choice).

Note the testing pattern, the mocks, and the assertion style.

- [ ] **Step 2: Write failing tests**

Append the following test inside the existing top-level `describe` in `server/tests/portfolio.test.js` (adapt mock imports to match the file's existing pattern — `priceService` and `fxService` may already be mocked or need to be added):

```js
  it('includes currency, native price, and comment in payload', async () => {
    const db = createTestDb();
    runMigrations(db);
    db.prepare('INSERT INTO assets (type, symbol, name, currency, comment) VALUES (?,?,?,?,?)')
      .run('stock', '0700.HK', 'Tencent', 'HKD', 'long-term hold');
    const assetId = db.prepare('SELECT id FROM assets WHERE symbol = ?').get('0700.HK').id;
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date) VALUES (?,?,?,?,?,?)')
      .run(assetId, 'buy', 100, 40, 312, '2025-01-15');

    getPortfolioPrices.mockResolvedValue({
      '0700.HK': {
        price_usd: 41,
        price_native: 320,
        currency: 'HKD',
        stale: false,
        updated_at: new Date().toISOString(),
      },
    });

    const app = createApp(db);
    const res = await request(app).get('/api/portfolio').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    const tencent = res.body.assets.find(a => a.symbol === '0700.HK');
    expect(tencent.currency).toBe('HKD');
    expect(tencent.comment).toBe('long-term hold');
    expect(tencent.current_price_native).toBe(320);
    expect(tencent.current_price).toBe(41);
    expect(tencent.avg_buy_price_native).toBe(312);
    expect(tencent.avg_buy_price).toBe(40);
  });
```

(If the test file doesn't already define `getPortfolioPrices` mock, `createApp`, `authCookie`, etc. — read those from the existing test setup and reuse the same imports/helpers.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx vitest run tests/portfolio.test.js`
Expected: FAIL — new fields not in payload.

- [ ] **Step 4: Update `server/routes/portfolio.js`**

Replace contents:

```js
const express = require('express');
const { getPortfolioPrices } = require('../services/priceService');
const { calcStockPnl, calcFlatPnl, roundUsd } = require('../services/pnl');

function createPortfolioRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const assets = db.prepare('SELECT * FROM assets ORDER BY created_at ASC').all();

      const priceMap = await getPortfolioPrices(db, assets);

      let totalValue = 0;
      let totalPnlUsd = 0;
      let totalCostBasis = 0;

      const enriched = assets.map(asset => {
        if (asset.type === 'stock' || asset.type === 'crypto') {
          const txs = db.prepare('SELECT * FROM transactions WHERE asset_id = ?').all(asset.id);
          const priceInfo = priceMap[asset.symbol] || {
            price_usd: null, price_native: null, currency: asset.currency || 'USD', stale: true,
          };
          const pnl = calcStockPnl(txs, priceInfo.price_usd);

          // Compute native avg buy: weighted by quantity over price_native (fall back to price_usd for legacy rows)
          const buys = txs.filter(t => t.action === 'buy');
          const totalBuyQty = buys.reduce((s, t) => s + t.quantity, 0);
          const avgBuyNative = totalBuyQty > 0
            ? buys.reduce((s, t) => s + (t.price_native != null ? t.price_native : t.price_usd) * t.quantity, 0) / totalBuyQty
            : null;

          if (!pnl.is_closed && pnl.current_value !== null) totalValue += pnl.current_value;
          if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
          if (pnl.avg_buy_price != null) {
            totalCostBasis += pnl.is_closed
              ? (pnl.avg_buy_price * buys.reduce((s, t) => s + t.quantity, 0))
              : (pnl.avg_buy_price * pnl.net_quantity);
          }

          return {
            ...asset,
            currency: asset.currency || 'USD',
            current_price: priceInfo.price_usd,
            current_price_native: priceInfo.price_native,
            avg_buy_price_native: avgBuyNative,
            price_stale: priceInfo.stale,
            price_updated_at: priceInfo.updated_at,
            ...pnl,
          };
        }

        if (asset.type === 'flat' || asset.type === 'other') {
          const valuations = db.prepare('SELECT * FROM flat_valuations WHERE asset_id = ? ORDER BY date DESC, id DESC').all(asset.id);
          const pnl = calcFlatPnl(valuations);
          const latest = valuations[0] || null;
          const latest_valuation = latest
            ? { id: latest.id, value_usd: latest.value_usd, date: latest.date }
            : null;

          if (pnl.current_value !== null) totalValue += pnl.current_value;
          if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
          if (pnl.cost_basis !== null) totalCostBasis += pnl.cost_basis;

          return { ...asset, currency: asset.currency || 'USD', latest_valuation, ...pnl };
        }

        return { ...asset, currency: asset.currency || 'USD' };
      });

      const pnlPct = totalCostBasis > 0
        ? roundUsd((totalPnlUsd / totalCostBasis) * 100)
        : null;

      res.json({
        assets: enriched,
        total_value: roundUsd(totalValue),
        total_pnl_usd: roundUsd(totalPnlUsd),
        total_pnl_pct: pnlPct,
      });
    } catch (err) {
      console.error('[portfolio] error:', err);
      res.status(500).json({ error: 'Failed to load portfolio' });
    }
  });

  return router;
}

module.exports = { createPortfolioRouter };
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd server && npx vitest run tests/portfolio.test.js`
Expected: PASS for the new test and all existing tests.

- [ ] **Step 6: Commit**

```bash
git add server/routes/portfolio.js server/tests/portfolio.test.js
git commit -m "feat(server): portfolio payload includes currency, native prices, comment"
```

---

## Task 7: Asset routes — PATCH endpoint + currency auto-detect on POST

**Files:**
- Modify: `server/routes/assets.js`
- Modify: `server/tests/assets.test.js`

- [ ] **Step 1: Write failing tests**

Read `server/tests/assets.test.js` for the existing pattern. Append:

```js
  it('PATCH /api/assets/:id accepts comment and updates partially', async () => {
    const db = createTestDb();
    runMigrations(db);
    const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'AAPL', 'Apple');
    const app = createApp(db);

    const res = await request(app)
      .patch(`/api/assets/${ins.lastInsertRowid}`)
      .set('Cookie', authCookie)
      .send({ comment: 'core holding' });

    expect(res.status).toBe(200);
    expect(res.body.comment).toBe('core holding');
    expect(res.body.name).toBe('Apple'); // unchanged
  });

  it('PATCH /api/assets/:id can update name + comment together', async () => {
    const db = createTestDb();
    runMigrations(db);
    const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'MSFT', 'Microsoft');
    const app = createApp(db);

    const res = await request(app)
      .patch(`/api/assets/${ins.lastInsertRowid}`)
      .set('Cookie', authCookie)
      .send({ name: 'MSFT Corp', comment: 'cloud bet' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('MSFT Corp');
    expect(res.body.comment).toBe('cloud bet');
  });

  it('PATCH /api/assets/:id rejects comment > 500 chars', async () => {
    const db = createTestDb();
    runMigrations(db);
    const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'AAPL', 'Apple');
    const app = createApp(db);

    const res = await request(app)
      .patch(`/api/assets/${ins.lastInsertRowid}`)
      .set('Cookie', authCookie)
      .send({ comment: 'x'.repeat(501) });

    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/assets.test.js`
Expected: FAIL — no PATCH handler defined.

- [ ] **Step 3: Update `server/routes/assets.js`**

Replace contents:

```js
const express = require('express');
const { fetchStockPrices, inferCurrencyFromSymbol } = require('../services/yahooFinance');

const VALID_TYPES = ['stock', 'crypto', 'flat', 'other'];

function createAssetsRouter(db) {
  const router = express.Router();

  const normalizeSymbol = symbol => String(symbol || '').toUpperCase().trim();

  router.post('/', (req, res) => {
    const { type, symbol, name } = req.body;
    if (!type || !symbol || !name) {
      return res.status(400).json({ error: 'type, symbol, and name are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    try {
      const normalized = normalizeSymbol(symbol);
      // Seed currency from suffix; refine asynchronously from Yahoo for stocks
      const seededCurrency = type === 'stock' ? inferCurrencyFromSymbol(normalized) : 'USD';
      const result = db.prepare('INSERT INTO assets (type, symbol, name, currency) VALUES (?, ?, ?, ?)')
        .run(type, normalized, name.trim(), seededCurrency);
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);

      // Fire-and-forget: refine currency from Yahoo chart meta
      if (type === 'stock') {
        fetchStockPrices([normalized]).then(map => {
          const info = map[normalized];
          if (info && info.currency && info.currency !== seededCurrency) {
            db.prepare('UPDATE assets SET currency = ? WHERE id = ?').run(info.currency, asset.id);
          }
        }).catch(err => console.warn(`[assets] currency refine failed for ${normalized}: ${err.message}`));
      }

      res.status(201).json(asset);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'An asset with this symbol already exists' });
      }
      console.error('[assets] error:', err);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });

  // PUT — full replacement (kept for back-compat)
  router.put('/:id', (req, res) => {
    const { type, symbol, name } = req.body;
    if (!type || !symbol || !name) {
      return res.status(400).json({ error: 'type, symbol, and name are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    try {
      db.prepare('UPDATE assets SET type = ?, symbol = ?, name = ? WHERE id = ?')
        .run(type, normalizeSymbol(symbol), name.trim(), req.params.id);
      const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'An asset with this symbol already exists' });
      }
      console.error('[assets] error:', err);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  // PATCH — partial update; supports name, comment, currency
  router.patch('/:id', (req, res) => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const { name, comment, currency } = req.body;

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string' || comment.length > 500) {
        return res.status(400).json({ error: 'comment must be a string of 500 characters or fewer' });
      }
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be a non-empty string' });
    }

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (comment !== undefined) { fields.push('comment = ?'); values.push(comment === '' ? null : comment); }
    if (currency !== undefined) { fields.push('currency = ?'); values.push(currency); }
    if (!fields.length) return res.json(asset);

    values.push(req.params.id);
    db.prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id));
  });

  router.delete('/:id', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAssetsRouter };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && npx vitest run tests/assets.test.js`
Expected: PASS for all (new + existing) cases.

- [ ] **Step 5: Commit**

```bash
git add server/routes/assets.js server/tests/assets.test.js
git commit -m "feat(server): PATCH /api/assets with comment; seed currency from symbol on POST"
```

---

## Task 8: Transactions route — accept price_native, add PATCH

**Files:**
- Modify: `server/routes/transactions.js`
- Modify: `server/tests/transactions.test.js`

- [ ] **Step 1: Write failing tests**

Append to `server/tests/transactions.test.js`:

```js
  it('POST stores price_native and computes price_usd via FX for non-USD assets', async () => {
    const db = createTestDb();
    runMigrations(db);
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.128, new Date().toISOString());
    const ins = db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','0700.HK','Tencent','HKD')").run();

    const app = createApp(db);
    const res = await request(app).post('/api/transactions').set('Cookie', authCookie).send({
      asset_id: ins.lastInsertRowid, action: 'buy', quantity: 100,
      price_native: 320, date: '2025-01-15',
    });
    expect(res.status).toBe(201);

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(res.body.id);
    expect(tx.price_native).toBe(320);
    expect(tx.price_usd).toBeCloseTo(320 * 0.128, 4);
  });

  it('POST treats price_usd as price_native for USD assets', async () => {
    const db = createTestDb();
    runMigrations(db);
    const ins = db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','AAPL','Apple','USD')").run();

    const app = createApp(db);
    const res = await request(app).post('/api/transactions').set('Cookie', authCookie).send({
      asset_id: ins.lastInsertRowid, action: 'buy', quantity: 10,
      price_usd: 192, date: '2025-01-15',
    });
    expect(res.status).toBe(201);

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(res.body.id);
    expect(tx.price_usd).toBe(192);
    expect(tx.price_native).toBe(192);
  });

  it('PATCH /api/transactions/:id updates quantity and recomputes price_usd from price_native', async () => {
    const db = createTestDb();
    runMigrations(db);
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.128, new Date().toISOString());
    const aIns = db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','0700.HK','Tencent','HKD')").run();
    const tIns = db.prepare("INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date) VALUES (?,?,?,?,?,?)")
      .run(aIns.lastInsertRowid, 'buy', 100, 40, 312, '2025-01-15');

    const app = createApp(db);
    const res = await request(app).patch(`/api/transactions/${tIns.lastInsertRowid}`).set('Cookie', authCookie).send({
      quantity: 150, price_native: 320,
    });
    expect(res.status).toBe(200);

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(tIns.lastInsertRowid);
    expect(tx.quantity).toBe(150);
    expect(tx.price_native).toBe(320);
    expect(tx.price_usd).toBeCloseTo(320 * 0.128, 4);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/transactions.test.js`
Expected: FAIL — POST doesn't accept `price_native`; PATCH doesn't exist.

- [ ] **Step 3: Update `server/routes/transactions.js`**

Replace contents:

```js
const express = require('express');
const { getUsdRate } = require('../services/fxService');

function createTransactionsRouter(db) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { asset_id, action, quantity, price_usd, price_native, date, remarks } = req.body;
    if (!asset_id || !action || !quantity || !date || (price_usd == null && price_native == null)) {
      return res.status(400).json({ error: 'asset_id, action, quantity, date, and price are required' });
    }
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'action must be buy or sell' });
    }
    if (quantity <= 0 || isNaN(quantity)) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }
    if (remarks !== undefined && remarks !== null && remarks !== '') {
      if (typeof remarks !== 'string' || remarks.length > 500) {
        return res.status(400).json({ error: 'remarks must be a string of 500 characters or fewer' });
      }
    }

    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const currency = asset.currency || 'USD';
    let nativePrice = price_native != null ? Number(price_native) : Number(price_usd);
    if (nativePrice <= 0 || isNaN(nativePrice)) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    let usdPrice;
    if (currency === 'USD') {
      usdPrice = nativePrice;
    } else {
      try {
        const rate = await getUsdRate(db, currency);
        usdPrice = nativePrice * rate;
      } catch (err) {
        return res.status(503).json({ error: `FX rate unavailable for ${currency}, try again` });
      }
    }

    const result = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date, remarks) VALUES (?,?,?,?,?,?,?)'
    ).run(asset_id, action, quantity, usdPrice, nativePrice, date, remarks || null);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  // PATCH — partial update: quantity and/or price_native (and recomputes price_usd via FX)
  router.patch('/:id', async (req, res) => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(tx.asset_id);

    const { quantity, price_native, remarks } = req.body;
    const updates = {};

    if (quantity !== undefined) {
      const q = Number(quantity);
      if (isNaN(q) || q <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });
      updates.quantity = q;
    }
    if (price_native !== undefined) {
      const p = Number(price_native);
      if (isNaN(p) || p <= 0) return res.status(400).json({ error: 'price_native must be a positive number' });
      updates.price_native = p;
      const currency = asset.currency || 'USD';
      try {
        const rate = currency === 'USD' ? 1 : await getUsdRate(db, currency);
        updates.price_usd = p * rate;
      } catch (err) {
        return res.status(503).json({ error: `FX rate unavailable for ${currency}, try again` });
      }
    }
    if (remarks !== undefined) {
      if (remarks !== null && remarks !== '' && (typeof remarks !== 'string' || remarks.length > 500)) {
        return res.status(400).json({ error: 'remarks must be a string of 500 characters or fewer' });
      }
      updates.remarks = remarks === '' ? null : remarks;
    }

    if (!Object.keys(updates).length) return res.json(tx);

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE transactions SET ${fields} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id));
  });

  // IMPORTANT: /export must be registered BEFORE /:assetId
  router.get('/export', (req, res) => {
    const rows = db.prepare(`
      SELECT t.id, t.date, t.action, t.quantity, t.price_usd, t.price_native,
             (t.quantity * t.price_usd) AS total_usd,
             t.remarks,
             a.name AS asset_name, a.symbol, a.type, a.currency
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      ORDER BY t.date DESC, t.created_at DESC
    `).all();
    res.json(rows);
  });

  router.get('/:assetId', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const txs = db.prepare(
      'SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.params.assetId);
    res.json(txs);
  });

  return router;
}

module.exports = { createTransactionsRouter };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && npx vitest run tests/transactions.test.js`
Expected: PASS for all (new + existing) cases. If an existing test asserts that POST requires `price_usd` specifically, update it to accept either field.

- [ ] **Step 5: Commit**

```bash
git add server/routes/transactions.js server/tests/transactions.test.js
git commit -m "feat(server): transactions accept price_native; add PATCH endpoint"
```

---

## Task 9: Flat valuations PATCH endpoint

**Files:**
- Modify: `server/routes/flatValuations.js`

- [ ] **Step 1: Write failing test**

Read `server/tests/portfolio.test.js` or similar for the `createApp`/`authCookie` pattern, then add a new test (in `server/tests/portfolio.test.js` or create `server/tests/flatValuations.test.js`):

```js
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const request = require('supertest');
const { createApp } = require('../app'); // adjust if path differs
// Reuse authCookie setup from existing tests

describe('PATCH /api/flat-valuations/:id', () => {
  it('updates value_usd', async () => {
    const db = createTestDb();
    runMigrations(db);
    const a = db.prepare("INSERT INTO assets (type, symbol, name) VALUES ('flat','HOME','My Home')").run();
    const v = db.prepare("INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)")
      .run(a.lastInsertRowid, 500000, '2024-12-01');

    const app = createApp(db);
    const res = await request(app)
      .patch(`/api/flat-valuations/${v.lastInsertRowid}`)
      .set('Cookie', authCookie)
      .send({ value_usd: 525000 });

    expect(res.status).toBe(200);
    const updated = db.prepare('SELECT * FROM flat_valuations WHERE id = ?').get(v.lastInsertRowid);
    expect(updated.value_usd).toBe(525000);
  });

  it('rejects negative value', async () => {
    const db = createTestDb();
    runMigrations(db);
    const a = db.prepare("INSERT INTO assets (type, symbol, name) VALUES ('flat','HOME','My Home')").run();
    const v = db.prepare("INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)")
      .run(a.lastInsertRowid, 500000, '2024-12-01');

    const app = createApp(db);
    const res = await request(app)
      .patch(`/api/flat-valuations/${v.lastInsertRowid}`)
      .set('Cookie', authCookie)
      .send({ value_usd: -1 });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run`
Expected: FAIL — no PATCH handler on flat-valuations.

- [ ] **Step 3: Update `server/routes/flatValuations.js`**

Replace contents:

```js
const express = require('express');

function createFlatValuationsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, value_usd, date } = req.body;
    if (!asset_id || value_usd == null || !date) {
      return res.status(400).json({ error: 'asset_id, value_usd, and date are required' });
    }
    if (isNaN(value_usd) || value_usd < 0) {
      return res.status(400).json({ error: 'value_usd must be a non-negative number' });
    }
    const asset = db.prepare("SELECT id, type FROM assets WHERE id = ?").get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (!['flat', 'other'].includes(asset.type)) {
      return res.status(400).json({ error: 'Valuations can only be added to flat or other assets' });
    }
    const result = db.prepare(
      'INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)'
    ).run(asset_id, value_usd, date);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.patch('/:id', (req, res) => {
    const v = db.prepare('SELECT * FROM flat_valuations WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Valuation not found' });

    const { value_usd, date } = req.body;
    const updates = {};
    if (value_usd !== undefined) {
      const n = Number(value_usd);
      if (isNaN(n) || n < 0) return res.status(400).json({ error: 'value_usd must be a non-negative number' });
      updates.value_usd = n;
    }
    if (date !== undefined) {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      }
      updates.date = date;
    }
    if (!Object.keys(updates).length) return res.json(v);

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE flat_valuations SET ${fields} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM flat_valuations WHERE id = ?').get(req.params.id));
  });

  return router;
}

module.exports = { createFlatValuationsRouter };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd server && npx vitest run`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add server/routes/flatValuations.js server/tests/
git commit -m "feat(server): PATCH /api/flat-valuations for editing latest valuation"
```

---

## Task 10: Client API helpers

**Files:**
- Modify: `client/src/api.js`

- [ ] **Step 1: Update `client/src/api.js`**

Add the following functions to the `api` object (do not remove existing ones):

```js
  patchAsset: (id, data) =>
    apiFetch(`/api/assets/${id}`, { method: 'PATCH', body: data }),

  updateTransaction: (id, data) =>
    apiFetch(`/api/transactions/${id}`, { method: 'PATCH', body: data }),

  updateValuation: (id, data) =>
    apiFetch(`/api/flat-valuations/${id}`, { method: 'PATCH', body: data }),
```

The final file should look like:

```js
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  getPortfolio: () => apiFetch('/api/portfolio'),
  addAsset: (data) => apiFetch('/api/assets', { method: 'POST', body: data }),
  deleteAsset: (id) => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
  updateAsset: (id, data) => apiFetch(`/api/assets/${id}`, { method: 'PUT', body: data }),
  patchAsset: (id, data) => apiFetch(`/api/assets/${id}`, { method: 'PATCH', body: data }),
  addTransaction: (data) => apiFetch('/api/transactions', { method: 'POST', body: data }),
  updateTransaction: (id, data) => apiFetch(`/api/transactions/${id}`, { method: 'PATCH', body: data }),
  getTransactions: (assetId) => apiFetch(`/api/transactions/${assetId}`),
  exportTransactions: () => apiFetch('/api/transactions/export'),
  addValuation: (data) => apiFetch('/api/flat-valuations', { method: 'POST', body: data }),
  updateValuation: (id, data) => apiFetch(`/api/flat-valuations/${id}`, { method: 'PATCH', body: data }),
  getPrice: (symbol, type) => apiFetch(`/api/prices/${symbol}?type=${type}`),
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api.js
git commit -m "feat(client): add patchAsset, updateTransaction, updateValuation"
```

---

## Task 11: Client format helper

**Files:**
- Create: `client/src/format.js`

- [ ] **Step 1: Create `client/src/format.js`**

```js
export function formatNative(value, currency) {
  if (value == null) return '—';
  const c = currency || 'USD';
  switch (c) {
    case 'USD': return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'HKD': return `HK$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'JPY': return `¥${Math.round(value).toLocaleString('en-US')}`;
    case 'GBp': return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}p`;
    case 'GBP': return `£${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'EUR': return `€${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'CNY': return `CN¥${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'KRW': return `₩${Math.round(value).toLocaleString('en-US')}`;
    case 'INR': return `₹${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    default:    return `${c} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatUsd(value) {
  if (value == null) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/format.js
git commit -m "feat(client): currency-aware formatNative helper"
```

---

## Task 12: FilterBar component

**Files:**
- Create: `client/src/components/FilterBar.jsx`

- [ ] **Step 1: Create `client/src/components/FilterBar.jsx`**

```jsx
const TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function FilterBar({ filterTypes, onToggle }) {
  return (
    <div style={styles.bar}>
      <span style={styles.label}>Show:</span>
      {TYPES.map(t => {
        const active = filterTypes.has(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            style={{ ...styles.chip, ...(active ? styles.chipActive : styles.chipInactive) }}
          >
            {t}
          </button>
        );
      })}
      {filterTypes.size === 0 && (
        <span style={styles.hint}>0 selected — showing all</span>
      )}
    </div>
  );
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 1rem', flexWrap: 'wrap' },
  label: { fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  chip: {
    padding: '4px 12px', borderRadius: '999px', cursor: 'pointer',
    fontSize: '0.8rem', fontWeight: '500', textTransform: 'capitalize',
    transition: 'all 0.15s',
  },
  chipActive: {
    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
    border: '1px solid var(--btn-primary-bg)',
  },
  chipInactive: {
    background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  hint: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' },
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/FilterBar.jsx
git commit -m "feat(client): FilterBar with type toggle chips"
```

---

## Task 13: AssetTable — currency rendering, comment icon, sortable headers

**Files:**
- Modify: `client/src/components/AssetTable.jsx`

- [ ] **Step 1: Replace `client/src/components/AssetTable.jsx`**

```jsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNative, formatUsd } from '../format';

function PnlCell({ value, pct, style }) {
  if (value == null) return <td style={{ ...styles.td, ...style }}>—</td>;
  const color = value >= 0 ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <td style={{ ...styles.td, color, fontWeight: '600', ...style }}>
      {value >= 0 ? '+' : ''}${value.toFixed(2)}
      {pct != null && (
        <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.85 }}>
          ({pct >= 0 ? '+' : ''}{pct}%)
        </span>
      )}
    </td>
  );
}

function PriceCell({ price, currency, stale, style }) {
  if (price == null) return <td style={{ ...styles.td, ...style, color: 'var(--text-secondary)' }}>—</td>;
  return (
    <td style={{ ...styles.td, ...style }}>
      {formatNative(price, currency)}
      {stale && <span title="Price may be outdated" style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>}
    </td>
  );
}

function CommentIcon({ comment }) {
  if (!comment) return null;
  return (
    <span title={comment} style={{ marginLeft: '6px', cursor: 'help', opacity: 0.7 }}>💬</span>
  );
}

const COLUMNS = [
  { key: 'name',          label: 'Name',          sortable: true },
  { key: 'type',          label: 'Type',          sortable: true },
  { key: 'symbol',        label: 'Symbol',        sortable: true },
  { key: 'net_quantity',  label: 'Qty',           sortable: true },
  { key: 'avg_buy',       label: 'Avg Buy',       sortable: true },
  { key: 'current_price', label: 'Current Price', sortable: true },
  { key: 'current_value', label: 'Value',         sortable: true },
  { key: 'pnl_usd',       label: 'P&L',           sortable: true },
  { key: 'updated_at',    label: 'Last Updated',  sortable: true },
  { key: 'actions',       label: 'Actions',       sortable: false },
];

function compareForKey(a, b, key) {
  const get = (g) => {
    switch (key) {
      case 'name':          return (g.name || '').toLowerCase();
      case 'type':          return g.type || '';
      case 'symbol':        return g.symbol || '';
      case 'net_quantity':  return g.totalQty ?? 0;
      case 'avg_buy':       return g.weightedAvgBuy ?? -Infinity;
      case 'current_price': return g.currentPrice ?? -Infinity;
      case 'current_value': return g.totalValue ?? -Infinity;
      case 'pnl_usd':       return g.totalPnl ?? -Infinity;
      case 'updated_at':    return g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
      default:              return 0;
    }
  };
  const va = get(a), vb = get(b);
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

export default function AssetTable({
  assets,
  onDelete,
  onAddValuation,
  onModify,
  filterTypes,
  sort,
  onSortChange,
}) {
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const visibleAssets = useMemo(() => {
    if (!filterTypes || filterTypes.size === 0) return assets;
    return assets.filter(a => filterTypes.has(a.type));
  }, [assets, filterTypes]);

  const grouped = useMemo(() => {
    const map = visibleAssets.reduce((acc, asset) => {
      const key = asset.name.trim().toLowerCase();
      if (!acc[key]) acc[key] = { key, name: asset.name, items: [] };
      acc[key].items.push(asset);
      return acc;
    }, {});

    const groups = Object.values(map).map(g => {
      const items = g.items;
      const totalQty = items.reduce((s, i) => s + (i.net_quantity || 0), 0);
      const weightedAvgBuyNative = totalQty
        ? items.reduce((s, i) => s + ((i.avg_buy_price_native ?? i.avg_buy_price) || 0) * (i.net_quantity || 0), 0) / totalQty
        : null;
      const weightedAvgBuy = totalQty
        ? items.reduce((s, i) => s + (i.avg_buy_price || 0) * (i.net_quantity || 0), 0) / totalQty
        : null;
      const totalValue = items.reduce((s, i) => s + (i.current_value || 0), 0);
      const allHavePnl = items.every(i => i.pnl_usd != null);
      const totalPnl = allHavePnl ? items.reduce((s, i) => s + i.pnl_usd, 0) : null;
      const costBasis = items.reduce((s, i) => s + (i.avg_buy_price || 0) * (i.net_quantity || 0), 0);
      const totalPnlPct = costBasis > 0 && totalPnl != null ? +((totalPnl / costBasis) * 100).toFixed(2) : null;
      const firstWithPrice = items.find(i => i.current_price_native != null) || items.find(i => i.current_price != null);
      const currentPriceNative = firstWithPrice?.current_price_native ?? firstWithPrice?.current_price ?? null;
      const currency = items[0].currency || 'USD';
      const priceStale = items.some(i => i.price_stale);
      const updatedAt = items.find(i => i.price_updated_at)?.price_updated_at ?? null;
      const type = items[0].type;
      const symbol = items[0].symbol;
      return {
        ...g, items, type, symbol, totalQty, weightedAvgBuy, weightedAvgBuyNative,
        totalValue, totalPnl, totalPnlPct, currentPriceNative, currency, priceStale, updatedAt,
      };
    });

    if (sort && sort.col && sort.dir) {
      groups.sort((a, b) => {
        const cmp = compareForKey(a, b, sort.col);
        return sort.dir === 'desc' ? -cmp : cmp;
      });
    } else {
      groups.sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [visibleAssets, sort]);

  if (!visibleAssets.length) {
    return <p style={{ color: 'var(--text-secondary)' }}>No assets match the current filter.</p>;
  }

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const rows = [];

  for (const g of grouped) {
    const isMulti = g.items.length > 1;
    const isExpanded = expandedGroups.has(g.key);

    if (!isMulti) {
      const asset = g.items[0];
      rows.push(<AssetRow key={asset.id} asset={asset} hovered={hoveredRow === asset.id}
        onHover={setHoveredRow} onNavigate={navigate}
        onDelete={onDelete} onModify={onModify} onAddValuation={onAddValuation} />);
      continue;
    }

    const groupHasComment = g.items.some(i => i.comment);
    const groupComments = g.items.filter(i => i.comment).map(i => `• ${i.comment}`).join('\n');

    rows.push(
      <tr key={`grp-${g.key}`} style={{ ...styles.row, background: 'var(--bg-table-header)' }}
        onClick={() => toggleGroup(g.key)}>
        <td style={styles.td}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: '14px', flexShrink: 0, fontSize: '0.65rem', opacity: 0.7 }}>
              {isExpanded ? '▼' : '▶'}
            </span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{g.name}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '5px' }}>({g.items.length})</span>
            {groupHasComment && <CommentIcon comment={groupComments} />}
          </div>
        </td>
        <td style={styles.td}><span style={styles.badge}>{g.type}</span></td>
        <td style={styles.td}><strong style={{ color: 'var(--text-muted)' }}>{g.symbol}</strong></td>
        <td style={styles.td}>{g.totalQty.toFixed(4)}</td>
        <td style={styles.td}>{g.weightedAvgBuyNative != null ? formatNative(g.weightedAvgBuyNative, g.currency) : '—'}</td>
        <PriceCell price={g.currentPriceNative} currency={g.currency} stale={g.priceStale} />
        <td style={styles.td}>{g.totalValue > 0 ? formatUsd(g.totalValue) : '—'}</td>
        <PnlCell value={g.totalPnl} pct={g.totalPnlPct} />
        <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {g.updatedAt ? new Date(g.updatedAt).toLocaleTimeString() : '—'}
        </td>
        <td style={styles.td} onClick={e => e.stopPropagation()} />
      </tr>
    );

    if (isExpanded) {
      g.items.forEach(asset => {
        rows.push(
          <AssetRow key={asset.id} asset={asset} hovered={hoveredRow === asset.id}
            onHover={setHoveredRow} onNavigate={navigate}
            onDelete={onDelete} onModify={onModify} onAddValuation={onAddValuation}
            indent />
        );
      });
    }
  }

  function handleHeaderClick(col) {
    if (!col.sortable || !onSortChange) return;
    onSortChange(col.key);
  }

  function sortIndicator(colKey) {
    if (!sort || sort.col !== colKey) return null;
    return <span style={{ marginLeft: '4px', fontSize: '0.65rem' }}>{sort.dir === 'desc' ? '▼' : '▲'}</span>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th
                key={c.key}
                style={{ ...styles.th, cursor: c.sortable && onSortChange ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={() => handleHeaderClick(c)}
              >
                {c.label}{sortIndicator(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function AssetRow({ asset, hovered, onHover, onNavigate, onDelete, onModify, onAddValuation, indent }) {
  const currency = asset.currency || 'USD';
  const avgBuyNative = asset.avg_buy_price_native ?? asset.avg_buy_price;
  const currentNative = asset.current_price_native ?? asset.current_price;

  return (
    <tr
      style={{ ...styles.row, background: hovered ? 'var(--row-hover)' : 'transparent' }}
      onClick={() => onNavigate(`/assets/${asset.id}`)}
      onMouseEnter={() => onHover(asset.id)}
      onMouseLeave={() => onHover(null)}
    >
      <td style={{ ...styles.td, paddingLeft: indent ? '28px' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {!indent && <span style={{ display: 'inline-block', width: '14px', flexShrink: 0 }} />}
          <div>
            {!indent && (
              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                {asset.name}<CommentIcon comment={asset.comment} />
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: indent ? 0 : '2px' }}>
              {asset.symbol}
              {indent && <CommentIcon comment={asset.comment} />}
            </div>
          </div>
        </div>
      </td>
      <td style={styles.td}><span style={styles.badge}>{asset.type}</span></td>
      <td style={styles.td}><strong style={{ color: 'var(--text-muted)' }}>{asset.symbol}</strong></td>
      <td style={styles.td}>{asset.net_quantity != null ? asset.net_quantity : '—'}</td>
      <td style={styles.td}>{avgBuyNative != null ? formatNative(avgBuyNative, currency) : '—'}</td>
      <PriceCell price={currentNative} currency={currency} stale={asset.price_stale} />
      <td style={styles.td}>{asset.current_value != null ? formatUsd(asset.current_value) : '—'}</td>
      <PnlCell value={asset.pnl_usd} pct={asset.pnl_pct} />
      <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {asset.price_updated_at ? new Date(asset.price_updated_at).toLocaleTimeString() : '—'}
      </td>
      <td style={styles.td} onClick={e => e.stopPropagation()}>
        {(asset.type === 'flat' || asset.type === 'other') && (
          <button style={styles.actionBtn} onClick={() => onAddValuation(asset)}>+ Val</button>
        )}
        <button style={styles.actionBtn} onClick={() => onModify(asset)}>Modify</button>
        <button style={{ ...styles.actionBtn, color: 'var(--pnl-down)', borderColor: 'var(--pnl-down)' }}
          onClick={() => onDelete(asset.id)}>Del</button>
      </td>
    </tr>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    padding: '8px 12px', textAlign: 'left', background: 'var(--bg-table-header)',
    borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
    color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  row: { cursor: 'pointer', transition: 'background 0.15s' },
  badge: {
    background: 'var(--badge-bg)', color: 'var(--text-muted)', borderRadius: '4px',
    padding: '2px 6px', fontSize: '0.75rem', whiteSpace: 'nowrap',
  },
  actionBtn: {
    marginRight: '4px', padding: '2px 8px', border: '1px solid var(--btn-secondary-border)',
    borderRadius: '4px', cursor: 'pointer', background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)', fontSize: '0.75rem',
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/AssetTable.jsx
git commit -m "feat(client): AssetTable with currency display, comment icon, sortable headers"
```

---

## Task 14: ModifyAssetModal (replaces EditAssetModal)

**Files:**
- Create: `client/src/components/ModifyAssetModal.jsx`
- Delete: `client/src/components/EditAssetModal.jsx`

- [ ] **Step 1: Create `client/src/components/ModifyAssetModal.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ModifyAssetModal({ asset, onClose, onSuccess }) {
  const [name, setName] = useState(asset.name || '');
  const [comment, setComment] = useState(asset.comment || '');
  const [latestTx, setLatestTx] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [valuationValue, setValuationValue] = useState(
    asset.latest_valuation ? String(asset.latest_valuation.value_usd) : ''
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isFlat = asset.type === 'flat' || asset.type === 'other';
  const currency = asset.currency || 'USD';

  useEffect(() => {
    if (isFlat) return;
    api.getTransactions(asset.id).then(txs => {
      const latest = txs[0]; // sorted DESC by date
      if (latest) {
        setLatestTx(latest);
        setQuantity(String(latest.quantity));
        setPrice(String(latest.price_native ?? latest.price_usd));
      }
    }).catch(() => {});
  }, [asset.id, isFlat]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.patchAsset(asset.id, {
        name: name.trim(),
        comment: comment.trim() || null,
      });

      if (!isFlat && latestTx) {
        const newQty = parseFloat(quantity);
        const newPrice = parseFloat(price);
        if (!isNaN(newQty) && !isNaN(newPrice) &&
            (newQty !== latestTx.quantity || newPrice !== (latestTx.price_native ?? latestTx.price_usd))) {
          await api.updateTransaction(latestTx.id, { quantity: newQty, price_native: newPrice });
        }
      }

      if (isFlat && asset.latest_valuation) {
        const newVal = parseFloat(valuationValue);
        if (!isNaN(newVal) && newVal !== asset.latest_valuation.value_usd) {
          await api.updateValuation(asset.latest_valuation.id, { value_usd: newVal });
        }
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Modify Asset</h2>
        <form onSubmit={handleSubmit} style={form}>
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)} required style={input} />
          </Field>
          <Field label="Comment">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Optional note about this asset"
            />
          </Field>

          {!isFlat && latestTx && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Latest transaction ({latestTx.action}, {latestTx.date}). For older transactions, use Transaction History.
              </div>
              <Field label="Quantity">
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} style={input} />
              </Field>
              <Field label={`Price per unit (${currency})`}>
                <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} style={input} />
              </Field>
            </>
          )}

          {!isFlat && !latestTx && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              No transactions yet — quantity/price fields will appear once a transaction exists.
            </div>
          )}

          {isFlat && asset.latest_valuation && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Latest valuation ({asset.latest_valuation.date}). For older valuations, open the asset detail page.
              </div>
              <Field label="Value (USD)">
                <input type="number" step="any" value={valuationValue}
                  onChange={e => setValuationValue(e.target.value)} style={input} />
              </Field>
            </>
          )}
          {isFlat && !asset.latest_valuation && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              No valuations yet — add one from the row's "+ Val" button.
            </div>
          )}

          {error && <p style={{ color: 'var(--pnl-down)', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modal = { background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '10px', width: '420px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow)' };
const form = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
const input = { padding: '8px', border: '1px solid var(--input-border)', borderRadius: '6px', fontSize: '1rem', background: 'var(--input-bg)', color: 'var(--input-text)' };
const submitBtn = { padding: '8px 20px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' };
const cancelBtn = { padding: '8px 20px', background: 'var(--btn-secondary-bg)', border: '1px solid var(--btn-secondary-border)', color: 'var(--btn-secondary-text)', borderRadius: '6px', cursor: 'pointer' };
```

- [ ] **Step 2: Delete `client/src/components/EditAssetModal.jsx`**

```bash
rm client/src/components/EditAssetModal.jsx
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ModifyAssetModal.jsx
git rm client/src/components/EditAssetModal.jsx
git commit -m "feat(client): ModifyAssetModal edits name/comment/latest transaction"
```

---

## Task 15: DashboardPage wiring — filter/sort state, ModifyAssetModal

**Files:**
- Modify: `client/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Replace `client/src/pages/DashboardPage.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTheme } from '../useTheme';
import SummaryBar from '../components/SummaryBar';
import AssetTable from '../components/AssetTable';
import AddAssetModal from '../components/AddAssetModal';
import AddValuationModal from '../components/AddValuationModal';
import ModifyAssetModal from '../components/ModifyAssetModal';
import FilterBar from '../components/FilterBar';
import * as XLSX from 'xlsx';

const ALL_TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [valuationAsset, setValuationAsset] = useState(null);
  const [modifyingAsset, setModifyingAsset] = useState(null);
  const [filterTypes, setFilterTypes] = useState(new Set(ALL_TYPES));
  const [sort, setSort] = useState({ col: null, dir: null });
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio();
      setPortfolio(data);
      setError('');
    } catch (err) {
      if (err?.message === 'Not authenticated') navigate('/login');
      else setError('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPortfolio();
    const interval = setInterval(loadPortfolio, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPortfolio]);

  function toggleType(t) {
    setFilterTypes(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  function handleSortChange(col) {
    setSort(prev => {
      if (prev.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc')  return { col, dir: 'desc' };
      return { col: null, dir: null };
    });
  }

  async function handleDelete(assetId) {
    if (!confirm('Delete this asset and all its transactions?')) return;
    try {
      await api.deleteAsset(assetId);
      loadPortfolio();
    } catch {
      setError('Failed to delete asset');
    }
  }

  async function handleLogout() {
    await api.logout();
    navigate('/login');
  }

  async function exportToExcel() {
    const data = await api.exportTransactions();
    if (!data) return;
    const rows = data.map(t => ({
      'Asset Name': t.asset_name,
      'Symbol': t.symbol,
      'Type': t.type,
      'Currency': t.currency || 'USD',
      'Date': t.date,
      'Action': t.action,
      'Quantity': t.quantity,
      'Price (Native)': t.price_native ?? t.price_usd,
      'Price (USD)': t.price_usd,
      'Total (USD)': t.total_usd,
      'Remarks': t.remarks ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div style={styles.center}>Loading…</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>Portfolio</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={loadPortfolio} style={styles.btn}>Refresh</button>
          <button onClick={exportToExcel} style={styles.btn}>Export to Excel</button>
          <button onClick={() => setShowAddAsset(true)} style={styles.btnPrimary}>+ Add Asset</button>
          <button onClick={toggleTheme} style={styles.btn} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} style={{ ...styles.btn, color: 'var(--pnl-down)' }}>Logout</button>
        </div>
      </header>

      {error && <p style={{ color: 'var(--pnl-down)', marginTop: 0 }}>{error}</p>}

      {portfolio && (
        <>
          <SummaryBar
            totalValue={portfolio.total_value}
            totalPnlUsd={portfolio.total_pnl_usd}
            totalPnlPct={portfolio.total_pnl_pct}
          />
          <FilterBar filterTypes={filterTypes} onToggle={toggleType} />
          <AssetTable
            assets={portfolio.assets}
            onDelete={handleDelete}
            onAddValuation={setValuationAsset}
            onModify={setModifyingAsset}
            filterTypes={filterTypes}
            sort={sort}
            onSortChange={handleSortChange}
          />
        </>
      )}

      {showAddAsset && (
        <AddAssetModal
          onClose={() => setShowAddAsset(false)}
          onSuccess={() => { setShowAddAsset(false); loadPortfolio(); }}
        />
      )}

      {valuationAsset && (
        <AddValuationModal
          asset={valuationAsset}
          onClose={() => setValuationAsset(null)}
          onSuccess={() => { setValuationAsset(null); loadPortfolio(); }}
        />
      )}

      {modifyingAsset && (
        <ModifyAssetModal
          asset={modifyingAsset}
          onClose={() => setModifyingAsset(null)}
          onSuccess={() => { setModifyingAsset(null); loadPortfolio(); }}
        />
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading: { margin: 0, fontSize: '1.75rem', color: 'var(--accent)', letterSpacing: '0.05em' },
  btn: { padding: '8px 16px', border: '1px solid var(--btn-secondary-border)', borderRadius: '6px', cursor: 'pointer', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)' },
  btnPrimary: { padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontWeight: '600' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/DashboardPage.jsx
git commit -m "feat(client): wire FilterBar, sort state, ModifyAssetModal into DashboardPage"
```

---

## Task 16: AddAssetModal label tweak

**Files:**
- Modify: `client/src/components/AddAssetModal.jsx`

- [ ] **Step 1: Update label text**

In `client/src/components/AddAssetModal.jsx`, replace:

```jsx
              <Field label="Price per unit (USD)">
```

with:

```jsx
              <Field label="Price per unit">
```

Below the Price field, add a small note. Find the line:

```jsx
              <Field label="Price per unit">
                <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} style={input} />
              </Field>
```

Add this hint immediately after it (still inside the `{!isFlat && (<>...</>)}` block):

```jsx
              {type === 'stock' && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '-4px 0 0' }}>
                  For non-US stocks, enter the price in the local currency. The currency is detected from the symbol (e.g. .HK → HKD).
                </p>
              )}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/AddAssetModal.jsx
git commit -m "feat(client): clarify price field label and currency hint in AddAssetModal"
```

---

## Task 17: Manual verification

- [ ] **Step 1: Start the server and client**

In one terminal:
```
cd server && npm run dev
```

In another:
```
cd client && npm run dev
```

- [ ] **Step 2: Verify each feature in the browser**

Log in and exercise:

1. **Foreign currency**: Add a stock with symbol `0700.HK` (Tencent), name "Tencent", quantity 100, price 320, date today. After portfolio refresh, the Avg Buy column should show `HK$320.00` and the Value column should show USD. Add `7203.T` (Toyota) and check it shows `¥` with no decimals.
2. **Crypto auto-resolve**: Add a crypto with symbol `PEPE`, name "Pepe", any qty/price. Verify current price populates (not `—`). Try `SAND`, `SEI`, `STRK`.
3. **Filter chips**: Click each chip to toggle visibility. Verify rows hide/show. Verify "0 selected" hint when all off.
4. **Sortable headers**: Click "Value" → arrow appears, sorted asc. Click again → desc. Click a third time → returns to default order. Repeat with "P&L".
5. **Comment**: Click Modify on any asset, add a comment, save. Verify 💬 icon appears next to name and tooltip shows on hover.
6. **Modify button**: Click Modify, change name, change quantity, save. Refresh — verify both changes stuck.

- [ ] **Step 3: Run the full server test suite one more time**

Run: `cd server && npx vitest run`
Expected: all green.

- [ ] **Step 4: Final commit (if any tweaks needed)**

If manual testing revealed bugs, fix them and commit. Otherwise no commit needed.

---

## Self-Review Checklist

- All six spec items have a task:
  1. Foreign currency → Tasks 1, 2, 3, 4, 6, 7, 8, 11, 13, 16
  2. Filters → Task 12, 13, 15
  3. Sortable headers → Task 13, 15
  4. Crypto auto-resolve → Task 5
  5. Comment field → Tasks 1, 6, 7, 13, 14
  6. Modify button → Tasks 7, 8, 9, 10, 13, 14
- No placeholders, TBDs, or "implement appropriate error handling" instructions.
- Method names consistent: `getUsdRate`, `fetchCryptoPrices(symbols, db)`, `inferCurrencyFromSymbol`, `patchAsset`, `updateTransaction`, `updateValuation`, `onModify`.
- Types consistent: portfolio payload always includes `currency`, `price_native`, `current_price_native`, `avg_buy_price_native`, `comment`.
