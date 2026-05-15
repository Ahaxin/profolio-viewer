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

  async function fetchBestQuote(rawSymbol) {
    const normalized = String(rawSymbol || '').toUpperCase().trim();
    const candidates = [normalized];

    // Support quote-pair symbols like "BTC/USD" — try the full string first, then each part.
    if (normalized.includes('/')) {
      candidates.push(...normalized.split('/').map(s => s.trim()).filter(Boolean));
    }

    for (const candidate of [...new Set(candidates)]) {
      try {
        const quote = await yahooFinance.quote(candidate, { fields: ['regularMarketPrice'] });
        if (quote?.regularMarketPrice != null) return quote.regularMarketPrice;
      } catch {
        // Try next candidate.
      }
    }
    return null;
  }

  const quotes = await Promise.all(symbols.map(fetchBestQuote));
  quotes.forEach((price, i) => {
    if (price != null) {
      results[symbols[i]] = price;
    }
  });
  return results;
}

module.exports = { fetchStockPrices };
