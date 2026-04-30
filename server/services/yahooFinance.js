/**
 * Fetch current prices for a list of stock symbols.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, number>>} symbol -> price map
 */
async function fetchStockPrices(symbols) {
  if (!symbols.length) return {};

  // yahoo-finance2 is ESM-only; use dynamic import in CJS context
  const { default: yahooFinance } = await import('yahoo-finance2');

  const results = {};
  // yahoo-finance2 supports individual quotes; batch via Promise.allSettled
  const quotes = await Promise.allSettled(
    symbols.map(s => yahooFinance.quote(s, { fields: ['regularMarketPrice'] }))
  );
  quotes.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value?.regularMarketPrice) {
      results[symbols[i]] = result.value.regularMarketPrice;
    }
  });
  return results;
}

module.exports = { fetchStockPrices };
