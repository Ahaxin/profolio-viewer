const express = require('express');
const cookieParser = require('cookie-parser');
const { verifyJwt } = require('./middleware/auth');
const { createAuthRouter } = require('./routes/auth');

function createApp(db) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());

  // Auth routes (public)
  app.use('/api/auth', createAuthRouter(db));

  // Protected routes placeholder — expanded in later tasks
  app.use('/api', verifyJwt);

  return app;
}

module.exports = { createApp };
