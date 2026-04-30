const Database = require('better-sqlite3');

function createTestDb() {
  // in-memory DB for tests
  const db = new Database(':memory:');
  return db;
}

module.exports = { createTestDb };
