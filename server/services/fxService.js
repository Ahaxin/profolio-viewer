const axios = require('axios');

const FX_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns the USD value of 1 unit of `currency`.
 * e.g. getUsdRate(db, 'HKD') ~= 0.128  (1 HKD = 0.128 USD)
 *
 * Special cases:
 *   USD  -> always 1, no DB/network hit
 *   GBp  -> GBP/100 (pence to pounds to USD)
 *
 * Cache strategy:
 *   - Fresh (< 1h): return cached value
 *   - Stale (>= 1h): fetch all rates from API, upsert cache, return refreshed value
 *   - Fetch fails + stale cache exists: log warning, return stale value
 *   - Fetch fails + no cache: throw
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} currency
 * @returns {Promise<number>}
 */
async function getUsdRate(db, currency) {
  if (currency === 'USD') return 1;

  const lookupCurrency = currency === 'GBp' ? 'GBP' : currency;
  const cached = db
    .prepare('SELECT rate_usd, updated_at FROM fx_rates_cache WHERE currency = ?')
    .get(lookupCurrency);

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
      if (perUsd > 0) upsert.run(code, 1 / perUsd, updatedAt);
    }

    const refreshed = db
      .prepare('SELECT rate_usd FROM fx_rates_cache WHERE currency = ?')
      .get(lookupCurrency);
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
 * Resolves USD rates for multiple currencies in one call.
 * Deduplicates currencies; returns null for any that fail to resolve.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} currencies
 * @returns {Promise<Record<string, number|null>>}
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
