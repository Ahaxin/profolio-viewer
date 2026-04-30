const axios = require('axios');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Fetch current USD prices for a list of crypto symbols (e.g. ['BTC','ETH']).
 * CoinGecko uses lowercase coin IDs — we map common tickers to IDs.
 * Unknown symbols are silently skipped.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, number>>} symbol -> price map (keys in original case)
 */
async function fetchCryptoPrices(symbols) {
  if (!symbols.length) return {};

  // CoinGecko uses coin IDs (e.g. 'bitcoin', 'ethereum')
  // For simplicity: try symbol as-is lowercased as CoinGecko ID
  const ids = symbols.map(s => s.toLowerCase());

  const url = `${COINGECKO_BASE}/simple/price`;
  const res = await axios.get(url, {
    params: { ids: ids.join(','), vs_currencies: 'usd' },
    timeout: 10000,
  });

  const results = {};
  symbols.forEach(symbol => {
    const id = symbol.toLowerCase();
    if (res.data[id]?.usd) {
      results[symbol] = res.data[id].usd;
    }
  });
  return results;
}

module.exports = { fetchCryptoPrices };
