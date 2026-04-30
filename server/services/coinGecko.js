const axios = require('axios');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Common ticker → CoinGecko ID mapping.
// If a ticker is not listed here, it is tried as-is (lowercase) as a CoinGecko ID.
const TICKER_TO_ID = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  LTC: 'litecoin',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
};

/**
 * Fetch current USD prices for a list of crypto symbols (e.g. ['BTC','ETH']).
 * Maps common tickers to CoinGecko IDs. Unknown symbols are tried as-is (lowercase).
 * @param {string[]} symbols
 * @returns {Promise<Record<string, number>>} symbol -> price map (keys in original case)
 */
async function fetchCryptoPrices(symbols) {
  if (!symbols.length) return {};

  // Map each symbol to its CoinGecko ID
  const symbolToId = {};
  symbols.forEach(symbol => {
    symbolToId[symbol] = TICKER_TO_ID[symbol.toUpperCase()] || symbol.toLowerCase();
  });

  const ids = [...new Set(Object.values(symbolToId))];

  const url = `${COINGECKO_BASE}/simple/price`;
  const res = await axios.get(url, {
    params: { ids: ids.join(','), vs_currencies: 'usd' },
    timeout: 10000,
  });

  const results = {};
  symbols.forEach(symbol => {
    const id = symbolToId[symbol];
    if (res.data[id]?.usd) {
      results[symbol] = res.data[id].usd;
    }
  });
  return results;
}

module.exports = { fetchCryptoPrices };
