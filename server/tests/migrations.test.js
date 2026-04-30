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
});
