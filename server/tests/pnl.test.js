const { calcStockPnl, calcFlatPnl, roundUsd } = require('../services/pnl');

describe('calcStockPnl', () => {
  const transactions = [
    { action: 'buy',  quantity: 10, price_usd: 100 },
    { action: 'buy',  quantity: 5,  price_usd: 120 },
    { action: 'sell', quantity: 3,  price_usd: 130 },
  ];

  it('calculates avg_buy_price correctly', () => {
    const result = calcStockPnl(transactions, 150);
    // (10*100 + 5*120) / 15 = 1600/15 ≈ 106.67
    expect(result.avg_buy_price).toBeCloseTo(106.67, 1);
  });

  it('calculates net_quantity correctly', () => {
    const result = calcStockPnl(transactions, 150);
    expect(result.net_quantity).toBe(12);
  });

  it('calculates current_value correctly', () => {
    const result = calcStockPnl(transactions, 150);
    expect(result.current_value).toBeCloseTo(12 * 150, 2);
  });

  it('calculates unrealized_pnl correctly', () => {
    const result = calcStockPnl(transactions, 150);
    // avg_buy_price = 1600/15 ≈ 106.67, net_qty = 12
    // pnl = (150 - 106.67) * 12 ≈ 519.96
    expect(result.pnl_usd).toBeCloseTo(519.96, 1);
  });

  it('throws on unknown transaction action', () => {
    const badTx = [{ action: 'transfer', quantity: 5, price_usd: 100 }];
    expect(() => calcStockPnl(badTx, 150)).toThrow('unknown action');
  });

  it('returns nulls for empty transaction array', () => {
    const result = calcStockPnl([], 150);
    expect(result.avg_buy_price).toBeNull();
    expect(result.pnl_usd).toBeNull();
    expect(result.is_closed).toBe(false);
  });

  it('handles closed position (net_quantity = 0)', () => {
    const closedTx = [
      { action: 'buy',  quantity: 5, price_usd: 100 },
      { action: 'sell', quantity: 5, price_usd: 150 },
    ];
    const result = calcStockPnl(closedTx, 200);
    expect(result.net_quantity).toBe(0);
    expect(result.is_closed).toBe(true);
    // realized_pnl = 5*150 - 5*100 = 250
    expect(result.pnl_usd).toBeCloseTo(250, 2);
    expect(result.current_value).toBe(0);
  });

  it('returns null fields when no current_price', () => {
    const result = calcStockPnl(transactions, null);
    expect(result.current_value).toBeNull();
    expect(result.pnl_usd).toBeNull();
    expect(result.pnl_pct).toBeNull();
  });
});

describe('calcFlatPnl', () => {
  it('calculates P&L from first to latest valuation', () => {
    const valuations = [
      { value_usd: 300000, date: '2020-01-01' },
      { value_usd: 350000, date: '2022-06-01' },
      { value_usd: 400000, date: '2024-01-01' },
    ];
    const result = calcFlatPnl(valuations);
    expect(result.cost_basis).toBe(300000);
    expect(result.current_value).toBe(400000);
    expect(result.pnl_usd).toBeCloseTo(100000, 2);
    expect(result.pnl_pct).toBeCloseTo(33.33, 1);
  });

  it('returns P&L of 0 when only one valuation', () => {
    const result = calcFlatPnl([{ value_usd: 300000, date: '2020-01-01' }]);
    expect(result.pnl_usd).toBe(0);
    expect(result.current_value).toBe(300000);
  });

  it('returns nulls when no valuations', () => {
    const result = calcFlatPnl([]);
    expect(result.current_value).toBeNull();
    expect(result.pnl_usd).toBeNull();
  });
});

describe('roundUsd', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundUsd(1.005)).toBe(1.01);
    expect(roundUsd(1.004)).toBe(1.00);
  });
});
