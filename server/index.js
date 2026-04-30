require('dotenv').config();
const { getDb } = require('./db/database');
const { runMigrations } = require('./db/migrations');
const { seedUser } = require('./db/seed');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;

async function start() {
  const db = getDb();
  runMigrations(db);
  await seedUser(db);

  const app = createApp(db);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
