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
});
