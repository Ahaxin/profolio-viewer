const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

let fetchStockPrices, fetchCryptoPrices, getPortfolioPrices;

beforeAll(async () => {
  vi.mock('../services/yahooFinance', () => ({
    fetchStockPrices: vi.fn(),
  }));
  vi.mock('../services/coinGecko', () => ({
    fetchCryptoPrices: vi.fn(),
  }));
  ({ fetchStockPrices } = await import('../services/yahooFinance'));
  ({ fetchCryptoPrices } = await import('../services/coinGecko'));
  ({ getPortfolioPrices } = await import('../services/priceService'));
});

describe('getPortfolioPrices', () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    runMigrations(db);
    vi.clearAllMocks();
  });

  it('returns cached price if fresh (< 5 min old)', async () => {
    const freshTime = new Date(Date.now() - 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 150, freshTime);

    fetchStockPrices.mockResolvedValue({});
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBe(150);
    expect(result['AAPL'].stale).toBe(false);
    expect(fetchStockPrices).not.toHaveBeenCalled();
  });

  it('fetches fresh price when cache is stale (> 5 min old)', async () => {
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 140, staleTime);

    fetchStockPrices.mockResolvedValue({ AAPL: 155 });
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBe(155);
    expect(result['AAPL'].stale).toBe(false);
  });

  it('returns stale cached price when fetch fails', async () => {
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 140, staleTime);

    fetchStockPrices.mockRejectedValue(new Error('network error'));
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBe(140);
    expect(result['AAPL'].stale).toBe(true);
  });

  it('returns null price with stale flag when no cache and fetch fails', async () => {
    fetchStockPrices.mockRejectedValue(new Error('network error'));
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBeNull();
    expect(result['AAPL'].stale).toBe(true);
  });

  it('skips price fetch for flat/other assets', async () => {
    const result = await getPortfolioPrices(db, [{ symbol: 'My Flat', type: 'flat' }]);
    expect(result['My Flat']).toBeUndefined();
    expect(fetchStockPrices).not.toHaveBeenCalled();
    expect(fetchCryptoPrices).not.toHaveBeenCalled();
  });
});
