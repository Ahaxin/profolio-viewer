const express = require('express');
const { getPortfolioPrices } = require('../services/priceService');

function createPricesRouter(db) {
  const router = express.Router();

  router.get('/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const type = req.query.type || 'stock';
    const prices = await getPortfolioPrices(db, [{ symbol, type }]);
    const info = prices[symbol] || { price_usd: null, stale: true };
    res.json({ symbol, ...info });
  });

  return router;
}

module.exports = { createPricesRouter };
