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
  const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('flat', 'HOME', 'My Home');
  assetId = ins.lastInsertRowid;
});

describe('PATCH /api/flat-valuations/:id', () => {
  it('updates value_usd and returns 200', async () => {
    const ins = db.prepare('INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)')
      .run(assetId, 500000, '2025-01-01');
    const res = await request(app).patch(`/api/flat-valuations/${ins.lastInsertRowid}`)
      .set('Cookie', cookie).send({ value_usd: 525000 });
    expect(res.status).toBe(200);
    expect(res.body.value_usd).toBe(525000);

    const row = db.prepare('SELECT * FROM flat_valuations WHERE id = ?').get(ins.lastInsertRowid);
    expect(row.value_usd).toBe(525000);
  });

  it('rejects negative value_usd with 400', async () => {
    const ins = db.prepare('INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)')
      .run(assetId, 500000, '2025-01-01');
    const res = await request(app).patch(`/api/flat-valuations/${ins.lastInsertRowid}`)
      .set('Cookie', cookie).send({ value_usd: -100 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch(`/api/flat-valuations/99999`)
      .set('Cookie', cookie).send({ value_usd: 1000 });
    expect(res.status).toBe(404);
  });

  it('allows partial update with only date', async () => {
    const ins = db.prepare('INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)')
      .run(assetId, 500000, '2025-01-01');
    const res = await request(app).patch(`/api/flat-valuations/${ins.lastInsertRowid}`)
      .set('Cookie', cookie).send({ date: '2025-06-15' });
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2025-06-15');
    expect(res.body.value_usd).toBe(500000);
  });

  it('rejects invalid date format with 400', async () => {
    const ins = db.prepare('INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)')
      .run(assetId, 500000, '2025-01-01');
    const res = await request(app).patch(`/api/flat-valuations/${ins.lastInsertRowid}`)
      .set('Cookie', cookie).send({ date: '06/15/2025' });
    expect(res.status).toBe(400);
  });
});
