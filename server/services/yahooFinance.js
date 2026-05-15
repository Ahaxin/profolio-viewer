const axios = require('axios');

/**
 * Fetch current prices for a list of stock symbols via Yahoo Finance v8 chart API.
 * Does not require crumb authentication.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, number>>} symbol -> price map
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
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}`;
        const res = await axios.get(url, {
          params: { interval: '1d', range: '1d' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000,
        });
        const price = res.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price != null) {
          results[symbol] = price;
          return;
        }
      } catch (err) {
        console.error(`[yahooFinance] ${candidate}: ${err.message}`);
      }
    }
  }));

  return results;
}

module.exports = { fetchStockPrices };
