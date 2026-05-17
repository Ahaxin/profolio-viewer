const yahooFinance = require('../services/yahooFinance');
const coinGecko = require('../services/coinGecko');
const fxService = require('../services/fxService');
const { getPortfolioPrices } = require('../services/priceService');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

let fetchStockPricesSpy, fetchCryptoPricesSpy, getUsdRateSpy;

beforeEach(() => {
  fetchStockPricesSpy = vi.spyOn(yahooFinance, 'fetchStockPrices');
  fetchCryptoPricesSpy = vi.spyOn(coinGecko, 'fetchCryptoPrices');
  getUsdRateSpy = vi.spyOn(fxService, 'getUsdRate');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getPortfolioPrices', () => {
  it('returns cached price with currency if fresh (< 5 min old)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const freshTime = new Date(Date.now() - 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 150, freshTime);

    fetchStockPricesSpy.mockResolvedValue({});
    getUsdRateSpy.mockResolvedValue(1); // USD → 1
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock', currency: 'USD' }]);
    expect(result['AAPL'].price_usd).toBe(150);
    expect(result['AAPL'].price_native).toBe(150);
    expect(result['AAPL'].currency).toBe('USD');
    expect(result['AAPL'].stale).toBe(false);
    expect(fetchStockPricesSpy).not.toHaveBeenCalled();
  });

  it('fetches fresh price when cache is stale and stores both USD + native', async () => {
    const db = createTestDb();
    runMigrations(db);
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('0700.HK', 30, staleTime);

    fetchStockPricesSpy.mockResolvedValue({ '0700.HK': { price: 320, currency: 'HKD' } });
    getUsdRateSpy.mockImplementation(async (db, c) => c === 'HKD' ? 0.128 : 1);

    const result = await getPortfolioPrices(db, [{ symbol: '0700.HK', type: 'stock', currency: 'HKD' }]);
    expect(result['0700.HK'].price_native).toBe(320);
    expect(result['0700.HK'].currency).toBe('HKD');
    expect(result['0700.HK'].price_usd).toBeCloseTo(320 * 0.128, 4);
    expect(result['0700.HK'].stale).toBe(false);
  });

  it('returns stale cached price when fetch fails', async () => {
    const db = createTestDb();
    runMigrations(db);
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 140, staleTime);

    fetchStockPricesSpy.mockRejectedValue(new Error('network error'));
    getUsdRateSpy.mockResolvedValue(1);
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock', currency: 'USD' }]);
    expect(result['AAPL'].price_usd).toBe(140);
    expect(result['AAPL'].stale).toBe(true);
  });

  it('returns null price with stale flag when no cache and fetch fails', async () => {
    const db = createTestDb();
    runMigrations(db);
    fetchStockPricesSpy.mockRejectedValue(new Error('network error'));
    getUsdRateSpy.mockResolvedValue(1);
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock', currency: 'USD' }]);
    expect(result['AAPL'].price_usd).toBeNull();
    expect(result['AAPL'].stale).toBe(true);
  });

  it('keeps fresh native price with null USD when FX fails on fetch', async () => {
    const db = createTestDb();
    runMigrations(db);
    fetchStockPricesSpy.mockResolvedValue({ '0700.HK': { price: 320, currency: 'HKD' } });
    getUsdRateSpy.mockRejectedValue(new Error('FX unavailable'));

    const result = await getPortfolioPrices(db, [{ symbol: '0700.HK', type: 'stock', currency: 'HKD' }]);
    expect(result['0700.HK'].price_native).toBe(320);
    expect(result['0700.HK'].price_usd).toBeNull();
    expect(result['0700.HK'].currency).toBe('HKD');
    expect(result['0700.HK'].stale).toBe(true);
  });

  it('skips price fetch for flat/other assets', async () => {
    const db = createTestDb();
    runMigrations(db);
    const result = await getPortfolioPrices(db, [{ symbol: 'My Flat', type: 'flat', currency: 'USD' }]);
    expect(result['My Flat']).toBeUndefined();
    expect(fetchStockPricesSpy).not.toHaveBeenCalled();
    expect(fetchCryptoPricesSpy).not.toHaveBeenCalled();
  });
});
