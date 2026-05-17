function runMigrations(db) {
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('stock','crypto','flat','other')),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('buy','sell')),
      quantity REAL NOT NULL,
      price_usd REAL NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prices_cache (
      symbol TEXT PRIMARY KEY,
      price_usd REAL,
      updated_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flat_valuations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      value_usd REAL NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fx_rates_cache (
      currency TEXT PRIMARY KEY,
      rate_usd REAL NOT NULL,
      updated_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crypto_id_map (
      symbol TEXT PRIMARY KEY,
      coin_gecko_id TEXT,
      resolved_at DATETIME NOT NULL
    );
  `);

  // Additive migration: remarks column on transactions
  const txCols = db.prepare("PRAGMA table_info(transactions)").all();
  if (!txCols.some(c => c.name === 'remarks')) {
    db.exec("ALTER TABLE transactions ADD COLUMN remarks TEXT");
  }
  if (!txCols.some(c => c.name === 'price_native')) {
    db.exec("ALTER TABLE transactions ADD COLUMN price_native REAL");
  }

  // Additive migration: currency + comment columns on assets
  const assetCols = db.prepare("PRAGMA table_info(assets)").all();
  if (!assetCols.some(c => c.name === 'currency')) {
    db.exec("ALTER TABLE assets ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD'");
  }
  if (!assetCols.some(c => c.name === 'comment')) {
    db.exec("ALTER TABLE assets ADD COLUMN comment TEXT");
  }
}

module.exports = { runMigrations };
