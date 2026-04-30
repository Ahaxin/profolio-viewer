const express = require('express');
const { getPortfolioPrices } = require('../services/priceService');
const { calcStockPnl, calcFlatPnl, roundUsd } = require('../services/pnl');

function createPortfolioRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const assets = db.prepare('SELECT * FROM assets ORDER BY created_at ASC').all();

      const priceMap = await getPortfolioPrices(db, assets);

      let totalValue = 0;
      let totalPnlUsd = 0;
      let totalCostBasis = 0;

      const enriched = assets.map(asset => {
        if (asset.type === 'stock' || asset.type === 'crypto') {
          const txs = db.prepare('SELECT * FROM transactions WHERE asset_id = ?').all(asset.id);
          const priceInfo = priceMap[asset.symbol] || { price_usd: null, stale: true };
          const pnl = calcStockPnl(txs, priceInfo.price_usd);

          if (!pnl.is_closed && pnl.current_value !== null) totalValue += pnl.current_value;
          if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
          if (pnl.avg_buy_price != null) {
            totalCostBasis += pnl.is_closed
              ? (pnl.avg_buy_price * txs.filter(t => t.action === 'buy').reduce((s, t) => s + t.quantity, 0))
              : (pnl.avg_buy_price * pnl.net_quantity);
          }

          return {
            ...asset,
            current_price: priceInfo.price_usd,
            price_stale: priceInfo.stale,
            price_updated_at: priceInfo.updated_at,
            ...pnl,
          };
        }

        if (asset.type === 'flat' || asset.type === 'other') {
          const valuations = db.prepare('SELECT * FROM flat_valuations WHERE asset_id = ?').all(asset.id);
          const pnl = calcFlatPnl(valuations);

          if (pnl.current_value !== null) totalValue += pnl.current_value;
          if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
          if (pnl.cost_basis !== null) totalCostBasis += pnl.cost_basis;

          return { ...asset, ...pnl };
        }

        return asset;
      });

      const pnlPct = totalCostBasis > 0
        ? roundUsd((totalPnlUsd / totalCostBasis) * 100)
        : null;

      res.json({
        assets: enriched,
        total_value: roundUsd(totalValue),
        total_pnl_usd: roundUsd(totalPnlUsd),
        total_pnl_pct: pnlPct,
      });
    } catch (err) {
      console.error('[portfolio] error:', err);
      res.status(500).json({ error: 'Failed to load portfolio' });
    }
  });

  return router;
}

module.exports = { createPortfolioRouter };
