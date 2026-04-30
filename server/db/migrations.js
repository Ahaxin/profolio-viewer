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
  `);
}

module.exports = { runMigrations };
