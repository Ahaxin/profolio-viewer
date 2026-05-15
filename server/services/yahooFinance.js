const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function fetchChart(host, candidate) {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(candidate)}`;
  const res = await axios.get(url, {
    params: { interval: '1d', range: '1d' },
    headers: HEADERS,
    timeout: 10000,
  });
  const price = res.data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (price == null) {
    console.warn(`[yahooFinance] ${host}/${candidate}: response ok but no price in payload`);
  }
  return price ?? null;
}

/**
 * Fetch current prices for a list of stock symbols via Yahoo Finance v8 chart API.
 * Tries query1 then query2 as fallback (query1 is sometimes blocked on datacenter IPs).
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
      for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
        try {
          const price = await fetchChart(host, candidate);
          if (price != null) {
            results[symbol] = price;
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

module.exports = { fetchStockPrices };
