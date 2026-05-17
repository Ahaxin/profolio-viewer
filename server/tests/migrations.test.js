const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

describe('migrations', () => {
  let db;
  beforeEach(() => { db = createTestDb(); });

  it('creates assets table', () => {
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assets'").get();
    expect(row).toBeDefined();
  });

  it('creates transactions table with foreign key', () => {
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'").get();
    expect(row).toBeDefined();
  });

  it('enforces transactions foreign key constraint (rejects invalid asset_id)', () => {
    runMigrations(db);
    // runMigrations already calls pragma foreign_keys = ON
    expect(() => {
      db.prepare("INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (999, 'buy', 1, 100, '2024-01-01')").run();
    }).toThrow();
  });

  it('creates prices_cache table', () => {
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prices_cache'").get();
    expect(row).toBeDefined();
  });

  it('creates flat_valuations table', () => {
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='flat_valuations'").get();
    expect(row).toBeDefined();
  });

  it('creates users table', () => {
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    expect(row).toBeDefined();
  });

  it('is idempotent — running twice does not throw', () => {
    expect(() => { runMigrations(db); runMigrations(db); }).not.toThrow();
  });

  it('transactions table has remarks column', () => {
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(transactions)").all();
    expect(cols.some(c => c.name === 'remarks')).toBe(true);
  });
});

describe('migrations — portfolio improvements', () => {
  it('adds currency column to assets defaulting to USD', () => {
    const db = createTestDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(assets)").all();
    const currency = cols.find(c => c.name === 'currency');
    expect(currency).toBeDefined();
    expect(currency.dflt_value).toBe("'USD'");
    expect(currency.notnull).toBe(1);
  });

  it('adds comment column to assets (nullable)', () => {
    const db = createTestDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(assets)").all();
    expect(cols.some(c => c.name === 'comment')).toBe(true);
  });

  it('adds price_native column to transactions (nullable)', () => {
    const db = createTestDb();
    runMigrations(db);
    const cols = db.prepare("PRAGMA table_info(transactions)").all();
    expect(cols.some(c => c.name === 'price_native')).toBe(true);
  });

  it('creates fx_rates_cache table', () => {
    const db = createTestDb();
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fx_rates_cache'").get();
    expect(row).toBeDefined();
  });

  it('creates crypto_id_map table', () => {
    const db = createTestDb();
    runMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='crypto_id_map'").get();
    expect(row).toBeDefined();
  });

  it('is idempotent (running twice does not fail)', () => {
    const db = createTestDb();
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
