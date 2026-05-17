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
    if (age < NEGATIVE_CACHE_TTL_MS) return null;
  }

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
 * Fetch current USD prices for a list of crypto symbols.
 * Resolves unknown symbols via CoinGecko /search and caches the mapping.
 * @param {string[]} symbols
 * @param {object} db — better-sqlite3 instance
 * @returns {Promise<Record<string, number>>}
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
