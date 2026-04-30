function roundUsd(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate P&L for stock/crypto assets.
 * @param {Array} transactions — array of {action, quantity, price_usd}
 * @param {number|null} currentPrice — current market price (null if unavailable)
 */
function calcStockPnl(transactions, currentPrice) {
  if (!transactions || transactions.length === 0) {
    return {
      net_quantity: 0,
      avg_buy_price: null,
      current_value: null,
      pnl_usd: null,
      pnl_pct: null,
      is_closed: false,
    };
  }

  let totalBuyQty = 0;
  let totalBuyCost = 0;
  let totalSellQty = 0;
  let totalSellProceeds = 0;

  for (const tx of transactions) {
    if (tx.action === 'buy') {
      totalBuyQty += tx.quantity;
      totalBuyCost += tx.quantity * tx.price_usd;
    } else if (tx.action === 'sell') {
      totalSellQty += tx.quantity;
      totalSellProceeds += tx.quantity * tx.price_usd;
    } else {
      throw new Error(`calcStockPnl: unknown action "${tx.action}"`);
    }
  }

  const netQuantity = totalBuyQty - totalSellQty;
  const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
  const isClosed = Math.abs(netQuantity) < 1e-10;

  if (isClosed) {
    const realizedPnl = totalSellProceeds - totalBuyCost;
    return {
      net_quantity: 0,
      avg_buy_price: roundUsd(avgBuyPrice),
      current_value: 0,
      pnl_usd: roundUsd(realizedPnl),
      pnl_pct: totalBuyCost > 0 ? roundUsd((realizedPnl / totalBuyCost) * 100) : null,
      is_closed: true,
    };
  }

  if (currentPrice === null || currentPrice === undefined) {
    return {
      net_quantity: netQuantity,
      avg_buy_price: roundUsd(avgBuyPrice),
      current_value: null,
      pnl_usd: null,
      pnl_pct: null,
      is_closed: false,
    };
  }

  const currentValue = netQuantity * currentPrice;
  const unrealizedPnl = (currentPrice - avgBuyPrice) * netQuantity;
  const pnlPct = avgBuyPrice > 0 ? (unrealizedPnl / (avgBuyPrice * netQuantity)) * 100 : null;

  return {
    net_quantity: netQuantity,
    avg_buy_price: roundUsd(avgBuyPrice),
    current_value: roundUsd(currentValue),
    pnl_usd: roundUsd(unrealizedPnl),
    pnl_pct: pnlPct !== null ? roundUsd(pnlPct) : null,
    is_closed: false,
  };
}

/**
 * Calculate P&L for flat/other assets using manual valuations.
 * @param {Array} valuations — array of {value_usd, date}, unsorted
 */
function calcFlatPnl(valuations) {
  if (!valuations || valuations.length === 0) {
    return { cost_basis: null, current_value: null, pnl_usd: null, pnl_pct: null };
  }

  const sorted = [...valuations].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  const costBasis = sorted[0].value_usd;
  const currentValue = sorted[sorted.length - 1].value_usd;
  const pnlUsd = currentValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnlUsd / costBasis) * 100 : null;

  return {
    cost_basis: roundUsd(costBasis),
    current_value: roundUsd(currentValue),
    pnl_usd: roundUsd(pnlUsd),
    pnl_pct: pnlPct !== null ? roundUsd(pnlPct) : null,
  };
}

module.exports = { calcStockPnl, calcFlatPnl, roundUsd };
