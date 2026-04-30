const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

let app, db, cookie;

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
});

describe('POST /api/assets', () => {
  it('creates an asset', async () => {
    const res = await request(app).post('/api/assets').set('Cookie', cookie)
      .send({ type: 'stock', symbol: 'TSLA', name: 'Tesla' });
    expect(res.status).toBe(201);
    expect(res.body.symbol).toBe('TSLA');
  });

  it('rejects invalid type', async () => {
    const res = await request(app).post('/api/assets').set('Cookie', cookie)
      .send({ type: 'banana', symbol: 'BAN', name: 'Banana' });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/assets').set('Cookie', cookie).send({ type: 'stock' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/assets/:id', () => {
  it('deletes an asset and its transactions', async () => {
    const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('crypto', 'BTC', 'Bitcoin');
    const id = ins.lastInsertRowid;
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)').run(id, 'buy', 1, 60000, '2024-01-01');

    const res = await request(app).delete(`/api/assets/${id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);

    const txs = db.prepare('SELECT * FROM transactions WHERE asset_id = ?').all(id);
    expect(txs).toHaveLength(0);
  });

  it('returns 404 for unknown asset', async () => {
    const res = await request(app).delete('/api/assets/99999').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
