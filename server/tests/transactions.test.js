const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

let app, db, cookie, assetId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';
  process.env.SEED_USERNAME = 'testuser';
  process.env.SEED_PASSWORD = 'testpass123';
  db = createTestDb();
  runMigrations(db);
  await seedUser(db);
  app = createApp(db);
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'testuser', password: 'testpass123' });
  cookie = loginRes.headers['set-cookie'][0];
  const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'AAPL', 'Apple');
  assetId = ins.lastInsertRowid;
});

describe('POST /api/transactions', () => {
  it('creates a buy transaction', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'buy', quantity: 5, price_usd: 150, date: '2024-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('rejects invalid action', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'hold', quantity: 5, price_usd: 150, date: '2024-01-01' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown asset', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: 99999, action: 'buy', quantity: 5, price_usd: 150, date: '2024-01-01' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/transactions/:assetId', () => {
  it('returns transactions sorted by date desc', async () => {
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)').run(assetId, 'buy', 2, 120, '2023-06-01');
    const res = await request(app).get(`/api/transactions/${assetId}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const dates = res.body.map(t => t.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });
});
