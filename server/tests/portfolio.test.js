const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

// Mock the underlying fetch services so priceService uses cache only
vi.mock('../services/yahooFinance', () => ({
  fetchStockPrices: vi.fn().mockResolvedValue({}),
}));
vi.mock('../services/coinGecko', () => ({
  fetchCryptoPrices: vi.fn().mockResolvedValue({}),
}));
const mockGetUsdRate = vi.fn().mockResolvedValue(1);
vi.mock('../services/fxService', () => ({
  getUsdRate: mockGetUsdRate,
  getUsdRates: vi.fn().mockResolvedValue({}),
}));

let app, db, cookie;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';
  process.env.SEED_USERNAME = 'testuser';
  process.env.SEED_PASSWORD = 'testpass123';
  db = createTestDb();
  runMigrations(db);
  await seedUser(db);
  app = createApp(db);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'testpass123' });
  cookie = loginRes.headers['set-cookie'][0];
});

describe('GET /api/portfolio', () => {
  it('returns empty portfolio when no assets', async () => {
    const res = await request(app).get('/api/portfolio').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.assets).toEqual([]);
    expect(res.body.total_value).toBe(0);
    expect(res.body.total_pnl_usd).toBe(0);
  });

  it('includes added asset in portfolio', async () => {
    db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'AAPL', 'Apple');
    const assetId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)').run(assetId, 'buy', 10, 100, '2024-01-01');

    // Seed a fresh cache entry so priceService returns it without fetching
    const freshTime = new Date(Date.now() - 60_000).toISOString();
    db.prepare('INSERT OR REPLACE INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 150, freshTime);

    const res = await request(app).get('/api/portfolio').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.assets).toHaveLength(1);
    expect(res.body.assets[0].symbol).toBe('AAPL');
    expect(res.body.assets[0].current_price).toBe(150);
    expect(res.body.assets[0].pnl_usd).toBeCloseTo(500, 1);
    expect(res.body.total_value).toBeGreaterThan(0);
  });

  it('includes currency, native price, comment and latest_valuation in payload', async () => {
    // Stock with native currency
    db.prepare('INSERT INTO assets (type, symbol, name, currency, comment) VALUES (?,?,?,?,?)')
      .run('stock', '0700.HK', 'Tencent', 'HKD', 'long-term hold');
    const tencentId = db.prepare('SELECT id FROM assets WHERE symbol = ?').get('0700.HK').id;
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date) VALUES (?,?,?,?,?,?)')
      .run(tencentId, 'buy', 100, 40, 312, '2025-01-15');
    // Seed price cache fresh so priceService returns it
    const freshTime = new Date(Date.now() - 60_000).toISOString();
    db.prepare('INSERT OR REPLACE INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)')
      .run('0700.HK', 41, freshTime);
    // Mock FX so HKD price_native derives correctly: 41 / 0.128 ≈ 320.31
    mockGetUsdRate.mockImplementation(async (db, c) => c === 'HKD' ? 0.128 : 1);

    // Flat asset with a valuation
    db.prepare("INSERT INTO assets (type, symbol, name) VALUES ('flat','HOME','My Home')").run();
    const homeId = db.prepare("SELECT id FROM assets WHERE symbol = 'HOME'").get().id;
    db.prepare("INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)")
      .run(homeId, 500000, '2025-01-01');

    const res = await request(app).get('/api/portfolio').set('Cookie', cookie);
    expect(res.status).toBe(200);

    const tencent = res.body.assets.find(a => a.symbol === '0700.HK');
    expect(tencent.currency).toBe('HKD');
    expect(tencent.comment).toBe('long-term hold');
    expect(tencent.current_price_native).toBeGreaterThan(310);
    expect(tencent.current_price).toBe(41);
    expect(tencent.avg_buy_price_native).toBe(312);
    expect(tencent.avg_buy_price).toBe(40);

    const home = res.body.assets.find(a => a.symbol === 'HOME');
    expect(home.currency).toBe('USD');
    expect(home.latest_valuation).toEqual({ id: expect.any(Number), value_usd: 500000, date: '2025-01-01' });
  });
});
