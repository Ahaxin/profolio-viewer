const axios = require('axios');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { getUsdRate, getUsdRates } = require('../services/fxService');

let axiosGetSpy;

beforeEach(() => {
  axiosGetSpy = vi.spyOn(axios, 'get');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fxService.getUsdRate', () => {
  it('returns 1 for USD without DB hit', async () => {
    const db = createTestDb();
    runMigrations(db);
    const rate = await getUsdRate(db, 'USD');
    expect(rate).toBe(1);
    expect(axiosGetSpy).not.toHaveBeenCalled();
  });

  it('returns cached rate if fresh (< 1h old)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const freshTime = new Date(Date.now() - 5 * 60_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.128, freshTime);

    const rate = await getUsdRate(db, 'HKD');
    expect(rate).toBe(0.128);
    expect(axiosGetSpy).not.toHaveBeenCalled();
  });

  it('fetches fresh rates when cache is stale (> 1h)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const staleTime = new Date(Date.now() - 2 * 3600_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.10, staleTime);

    axiosGetSpy.mockResolvedValue({
      data: { result: 'success', rates: { HKD: 7.80, JPY: 156.0, GBP: 0.79 } },
    });

    const rate = await getUsdRate(db, 'HKD');
    expect(rate).toBeCloseTo(1 / 7.80, 6);
    expect(axiosGetSpy).toHaveBeenCalled();
  });

  it('falls back to stale cache when fetch fails', async () => {
    const db = createTestDb();
    runMigrations(db);
    const staleTime = new Date(Date.now() - 2 * 3600_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)')
      .run('HKD', 0.10, staleTime);

    axiosGetSpy.mockRejectedValue(new Error('network error'));
    const rate = await getUsdRate(db, 'HKD');
    expect(rate).toBe(0.10);
    expect(axiosGetSpy).toHaveBeenCalled();
  });

  it('throws when no cache exists and fetch fails', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy.mockRejectedValue(new Error('network error'));
    await expect(getUsdRate(db, 'HKD')).rejects.toThrow();
    expect(axiosGetSpy).toHaveBeenCalled();
  });

  it('handles GBp (pence) as GBP / 100', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy.mockResolvedValue({
      data: { result: 'success', rates: { GBP: 0.79 } },
    });
    const rate = await getUsdRate(db, 'GBp');
    expect(rate).toBeCloseTo((1 / 0.79) / 100, 8);
    expect(axiosGetSpy).toHaveBeenCalled();
  });
});

describe('fxService.getUsdRates', () => {
  it('resolves multiple currencies', async () => {
    const db = createTestDb();
    runMigrations(db);
    const freshTime = new Date(Date.now() - 5 * 60_000).toISOString();
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)').run('HKD', 0.128, freshTime);
    db.prepare('INSERT INTO fx_rates_cache (currency, rate_usd, updated_at) VALUES (?,?,?)').run('JPY', 0.0064, freshTime);

    const rates = await getUsdRates(db, ['USD', 'HKD', 'JPY']);
    expect(rates['USD']).toBe(1);
    expect(rates['HKD']).toBe(0.128);
    expect(rates['JPY']).toBe(0.0064);
    expect(axiosGetSpy).not.toHaveBeenCalled();
  });

  it('returns null for currencies that cannot be resolved', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy.mockRejectedValue(new Error('network error'));

    const rates = await getUsdRates(db, ['XYZ']);
    expect(rates['XYZ']).toBeNull();
  });
});
