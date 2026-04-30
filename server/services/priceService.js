const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get prices for a list of assets, using cache where fresh.
 * @param {object} db — better-sqlite3 instance
 * @param {Array<{symbol: string, type: string}>} assets
 * @returns {Promise<Record<string, {price_usd, stale, updated_at}>>}
 */
async function getPortfolioPrices(db, assets) {
  const now = Date.now();
  const result = {};
  const staleStocks = [];
  const staleCrypto = [];

  for (const { symbol, type } of assets) {
    if (type === 'flat' || type === 'other') continue;

    const cached = db.prepare('SELECT price_usd, updated_at FROM prices_cache WHERE symbol = ?').get(symbol);
    const isFresh = cached && (now - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS;

    if (isFresh) {
      result[symbol] = { price_usd: cached.price_usd, stale: false, updated_at: cached.updated_at };
    } else {
      // needs refresh — collect by type
      if (type === 'stock') staleStocks.push(symbol);
      else if (type === 'crypto') staleCrypto.push(symbol);
      // store existing cache as fallback
      result[symbol] = cached
        ? { price_usd: cached.price_usd, stale: true, updated_at: cached.updated_at }
        : { price_usd: null, stale: true, updated_at: null };
    }
  }

  // Batch fetch stale stocks
  if (staleStocks.length) {
    try {
      const { fetchStockPrices } = await import('./yahooFinance');
      const fresh = await fetchStockPrices(staleStocks);
      _updateCache(db, fresh, result);
    } catch {
      // keep stale fallback already set above
    }
  }

  // Batch fetch stale crypto
  if (staleCrypto.length) {
    try {
      const { fetchCryptoPrices } = await import('./coinGecko');
      const fresh = await fetchCryptoPrices(staleCrypto);
      _updateCache(db, fresh, result);
    } catch {
      // keep stale fallback
    }
  }

  return result;
}

function _updateCache(db, freshPrices, result) {
  const updatedAt = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET price_usd = excluded.price_usd, updated_at = excluded.updated_at
  `);
  for (const [symbol, price] of Object.entries(freshPrices)) {
    upsert.run(symbol, price, updatedAt);
    result[symbol] = { price_usd: price, stale: false, updated_at: updatedAt };
  }
}

module.exports = { getPortfolioPrices };
