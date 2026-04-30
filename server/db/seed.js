const bcrypt = require('bcrypt');

async function seedUser(db) {
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existing) return; // no-op if user already exists

  const { SEED_USERNAME, SEED_PASSWORD } = process.env;
  if (!SEED_USERNAME || !SEED_PASSWORD) {
    console.warn('SEED_USERNAME or SEED_PASSWORD not set — skipping user seed');
    return;
  }

  const hash = await bcrypt.hash(SEED_PASSWORD, 12);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(SEED_USERNAME, hash);
  console.log(`Seeded user: ${SEED_USERNAME}`);
}

module.exports = { seedUser };
