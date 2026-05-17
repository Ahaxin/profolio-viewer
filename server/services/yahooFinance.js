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
