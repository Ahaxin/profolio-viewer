const CACHE_TTL_MS = 5 * 60 * 1000;

const yahooFinance = require('./yahooFinance');
const coinGecko = require('./coinGecko');
const fxService = require('./fxService');

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
      // store existing cache as stale fallback
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
      const fresh = await yahooFinance.fetchStockPrices(staleStocks);
      // fresh: { SYMBOL: { price, currency } }
      const usdMap = {};
      for (const [symbol, info] of Object.entries(fresh)) {
        const nativeCurrency = info.currency || currencyBySymbol[symbol] || 'USD';
        try {
          const rate = await fxService.getUsdRate(db, nativeCurrency);
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
          result[symbol] = {
            price_usd: null,
            price_native: info.price,
            currency: nativeCurrency,
            stale: true,
            updated_at: new Date().toISOString(),
          };
        }
      }
      _persistUsdCache(db, usdMap);
    } catch (err) {
      console.error(`[priceService] Failed to fetch stock prices for [${staleStocks.join(', ')}]:`, err.message);
    }
  }

  if (staleCrypto.length) {
    try {
      const fresh = await coinGecko.fetchCryptoPrices(staleCrypto, db);
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
    const rate = await fxService.getUsdRate(db, currency);
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
