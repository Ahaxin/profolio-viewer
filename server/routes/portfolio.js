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
          const priceInfo = priceMap[asset.symbol] || {
            price_usd: null, price_native: null, currency: asset.currency || 'USD', stale: true,
          };
          const pnl = calcStockPnl(txs, priceInfo.price_usd);

          const buys = txs.filter(t => t.action === 'buy');
          const totalBuyQty = buys.reduce((s, t) => s + t.quantity, 0);
          const avgBuyNative = totalBuyQty > 0
            ? buys.reduce((s, t) => s + (t.price_native != null ? t.price_native : t.price_usd) * t.quantity, 0) / totalBuyQty
            : null;

          if (!pnl.is_closed && pnl.current_value !== null) totalValue += pnl.current_value;
          if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
          if (pnl.avg_buy_price != null) {
            totalCostBasis += pnl.is_closed
              ? (pnl.avg_buy_price * buys.reduce((s, t) => s + t.quantity, 0))
              : (pnl.avg_buy_price * pnl.net_quantity);
          }

          return {
            ...asset,
            currency: asset.currency || 'USD',
            current_price: priceInfo.price_usd,
            current_price_native: priceInfo.price_native,
            avg_buy_price_native: avgBuyNative,
            price_stale: priceInfo.stale,
            price_updated_at: priceInfo.updated_at,
            ...pnl,
          };
        }

        if (asset.type === 'flat' || asset.type === 'other') {
          const valuations = db.prepare('SELECT * FROM flat_valuations WHERE asset_id = ? ORDER BY date DESC, id DESC').all(asset.id);
          const pnl = calcFlatPnl(valuations);
          const latest = valuations[0] || null;
          const latest_valuation = latest
            ? { id: latest.id, value_usd: latest.value_usd, date: latest.date }
            : null;

          if (pnl.current_value !== null) totalValue += pnl.current_value;
          if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
          if (pnl.cost_basis !== null) totalCostBasis += pnl.cost_basis;

          return { ...asset, currency: asset.currency || 'USD', latest_valuation, ...pnl };
        }

        return { ...asset, currency: asset.currency || 'USD' };
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
