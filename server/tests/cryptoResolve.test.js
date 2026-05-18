const axios = require('axios');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { fetchCryptoPrices } = require('../services/coinGecko');

let axiosGetSpy;

beforeEach(() => {
  axiosGetSpy = vi.spyOn(axios, 'get');
});

afterEach(() => {
  axiosGetSpy.mockRestore();
});

describe('fetchCryptoPrices — auto-resolve unknown symbols', () => {
  it('uses hardcoded TICKER_TO_ID map for known symbols', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy.mockResolvedValue({ data: { bitcoin: { usd: 60000 } } });

    const res = await fetchCryptoPrices(['BTC'], db);
    expect(res.BTC).toBe(60000);
    expect(axiosGetSpy).toHaveBeenCalledTimes(1);
    expect(axiosGetSpy.mock.calls[0][0]).toContain('/simple/price');
  });

  it('resolves unknown symbol via /search and caches it', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy
      .mockResolvedValueOnce({ data: { coins: [{ id: 'fake-coin', symbol: 'fake', name: 'Fake' }] } })
      .mockResolvedValueOnce({ data: { 'fake-coin': { usd: 0.0000018 } } });

    const res = await fetchCryptoPrices(['FAKE'], db);
    expect(res.FAKE).toBe(0.0000018);

    const cached = db.prepare('SELECT coin_gecko_id FROM crypto_id_map WHERE symbol = ?').get('FAKE');
    expect(cached.coin_gecko_id).toBe('fake-coin');
  });

  it('uses cached coin_gecko_id on second call (no /search)', async () => {
    const db = createTestDb();
    runMigrations(db);
    db.prepare('INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?,?,?)')
      .run('SAND', 'the-sandbox', new Date().toISOString());

    axiosGetSpy.mockResolvedValue({ data: { 'the-sandbox': { usd: 0.50 } } });
    const res = await fetchCryptoPrices(['SAND'], db);
    expect(res.SAND).toBe(0.50);
    expect(axiosGetSpy).toHaveBeenCalledTimes(1);
    expect(axiosGetSpy.mock.calls[0][0]).toContain('/simple/price');
  });

  it('negative-caches when /search returns no match', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy
      .mockResolvedValueOnce({ data: { coins: [] } })
      .mockResolvedValueOnce({ data: {} });

    const res = await fetchCryptoPrices(['ZZZZUNKNOWN'], db);
    expect(res.ZZZZUNKNOWN).toBeUndefined();

    const cached = db.prepare('SELECT coin_gecko_id FROM crypto_id_map WHERE symbol = ?').get('ZZZZUNKNOWN');
    expect(cached).toBeDefined();
    expect(cached.coin_gecko_id).toBeNull();
  });

  it('respects 24h negative cache (no /search retry)', async () => {
    const db = createTestDb();
    runMigrations(db);
    const recentlyFailed = new Date(Date.now() - 60 * 60_000).toISOString();
    db.prepare('INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?,?,?)')
      .run('GHOSTCOIN', null, recentlyFailed);

    const res = await fetchCryptoPrices(['GHOSTCOIN'], db);
    expect(res.GHOSTCOIN).toBeUndefined();
    expect(axiosGetSpy).not.toHaveBeenCalled();
  });

  it('retries /search after 24h negative cache expires', async () => {
    const db = createTestDb();
    runMigrations(db);
    const dayOld = new Date(Date.now() - 25 * 3600_000).toISOString();
    db.prepare('INSERT INTO crypto_id_map (symbol, coin_gecko_id, resolved_at) VALUES (?,?,?)')
      .run('LATEFAKE', null, dayOld);

    axiosGetSpy
      .mockResolvedValueOnce({ data: { coins: [{ id: 'late-fake', symbol: 'latefake' }] } })
      .mockResolvedValueOnce({ data: { 'late-fake': { usd: 0.45 } } });

    const res = await fetchCryptoPrices(['LATEFAKE'], db);
    expect(res.LATEFAKE).toBe(0.45);
  });

  it('matches symbol case-insensitively in search results', async () => {
    const db = createTestDb();
    runMigrations(db);
    axiosGetSpy
      .mockResolvedValueOnce({ data: { coins: [
        { id: 'somethingelse', symbol: 'other' },
        { id: 'caseycoin', symbol: 'casey' },
      ] } })
      .mockResolvedValueOnce({ data: { caseycoin: { usd: 1.2 } } });

    const res = await fetchCryptoPrices(['CASEY'], db);
    expect(res.CASEY).toBe(1.2);
  });
});
