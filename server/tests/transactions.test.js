const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');
const fxService = require('../services/fxService');

let getUsdRate;

let app, db, cookie, assetId;

beforeEach(() => {
  getUsdRate = vi.spyOn(fxService, 'getUsdRate').mockResolvedValue(1);
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('stores and returns remarks when provided', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'buy', quantity: 1, price_usd: 100, date: '2024-03-01', remarks: 'test entry reason' });
    expect(res.status).toBe(201);

    const getRes = await request(app).get(`/api/transactions/${assetId}`).set('Cookie', cookie);
    const tx = getRes.body.find(t => t.id === res.body.id);
    expect(tx.remarks).toBe('test entry reason');
  });

  it('accepts transaction without remarks', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'sell', quantity: 1, price_usd: 110, date: '2024-03-02' });
    expect(res.status).toBe(201);

    const getRes = await request(app).get(`/api/transactions/${assetId}`).set('Cookie', cookie);
    const tx = getRes.body.find(t => t.id === res.body.id);
    expect(tx.remarks === null || tx.remarks === '').toBe(true);
  });

  it('rejects remarks longer than 500 characters', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'buy', quantity: 1, price_usd: 100, date: '2024-03-03', remarks: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('POST stores price_native and computes price_usd via FX for non-USD assets', async () => {
    db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','HKTEST','HK Test','HKD')").run();
    const aId = db.prepare("SELECT id FROM assets WHERE symbol = 'HKTEST'").get().id;
    getUsdRate.mockImplementation(async (db, c) => c === 'HKD' ? 0.128 : 1);

    const res = await request(app).post('/api/transactions').set('Cookie', cookie).send({
      asset_id: aId, action: 'buy', quantity: 100,
      price_native: 320, date: '2025-01-15',
    });
    expect(res.status).toBe(201);

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(res.body.id);
    expect(tx.price_native).toBe(320);
    expect(tx.price_usd).toBeCloseTo(320 * 0.128, 4);
  });

  it('POST treats price_usd as price_native for USD assets', async () => {
    db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','USDTEST','US Test','USD')").run();
    const aId = db.prepare("SELECT id FROM assets WHERE symbol = 'USDTEST'").get().id;
    getUsdRate.mockResolvedValue(1);

    const res = await request(app).post('/api/transactions').set('Cookie', cookie).send({
      asset_id: aId, action: 'buy', quantity: 10,
      price_usd: 192, date: '2025-01-15',
    });
    expect(res.status).toBe(201);

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(res.body.id);
    expect(tx.price_usd).toBe(192);
    expect(tx.price_native).toBe(192);
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

describe('GET /api/transactions/export', () => {
  let exportTxId;

  beforeAll(() => {
    const r = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)'
    ).run(assetId, 'buy', 3, 200, '2024-06-01');
    exportTxId = r.lastInsertRowid;
  });

  it('returns 200 with an array when authenticated', async () => {
    const res = await request(app).get('/api/transactions/export').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('includes asset_name and symbol in each row', async () => {
    const res = await request(app).get('/api/transactions/export').set('Cookie', cookie);
    const row = res.body.find(r => r.id === exportTxId);
    expect(row.asset_name).toBe('Apple');
    expect(row.symbol).toBe('AAPL');
  });

  it('computes total_usd as quantity * price_usd', async () => {
    const res = await request(app).get('/api/transactions/export').set('Cookie', cookie);
    const row = res.body.find(r => r.id === exportTxId);
    expect(row.total_usd).toBeCloseTo(3 * 200);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/api/transactions/export');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/transactions/:id', () => {
  it('updates quantity and recomputes price_usd from price_native', async () => {
    db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','HKPATCH','HK Patch','HKD')").run();
    const aId = db.prepare("SELECT id FROM assets WHERE symbol = 'HKPATCH'").get().id;
    const tIns = db.prepare("INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date) VALUES (?,?,?,?,?,?)")
      .run(aId, 'buy', 100, 40, 312, '2025-01-15');
    getUsdRate.mockImplementation(async (db, c) => c === 'HKD' ? 0.128 : 1);

    const res = await request(app).patch(`/api/transactions/${tIns.lastInsertRowid}`).set('Cookie', cookie).send({
      quantity: 150, price_native: 320,
    });
    expect(res.status).toBe(200);

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(tIns.lastInsertRowid);
    expect(tx.quantity).toBe(150);
    expect(tx.price_native).toBe(320);
    expect(tx.price_usd).toBeCloseTo(320 * 0.128, 4);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch(`/api/transactions/99999`).set('Cookie', cookie).send({ quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('rejects invalid quantity', async () => {
    db.prepare("INSERT INTO assets (type, symbol, name, currency) VALUES ('stock','PATCHBAD','Bad','USD')").run();
    const aId = db.prepare("SELECT id FROM assets WHERE symbol = 'PATCHBAD'").get().id;
    const tIns = db.prepare("INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date) VALUES (?,?,?,?,?,?)")
      .run(aId, 'buy', 1, 1, 1, '2025-01-15');
    const res = await request(app).patch(`/api/transactions/${tIns.lastInsertRowid}`).set('Cookie', cookie).send({ quantity: -5 });
    expect(res.status).toBe(400);
  });
});
