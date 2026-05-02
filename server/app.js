const express = require('express');
const cookieParser = require('cookie-parser');
const { verifyJwt } = require('./middleware/auth');
const { createAuthRouter } = require('./routes/auth');
const { createPortfolioRouter } = require('./routes/portfolio');
const { createAssetsRouter } = require('./routes/assets');
const { createTransactionsRouter } = require('./routes/transactions');
const { createPricesRouter } = require('./routes/prices');
const { createFlatValuationsRouter } = require('./routes/flatValuations');

function createApp(db) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());

  // Health check (public)
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Public auth routes
  app.use('/api/auth', createAuthRouter(db));

  // All routes below require valid JWT
  app.use('/api', verifyJwt);
  app.use('/api/portfolio', createPortfolioRouter(db));
  app.use('/api/assets', createAssetsRouter(db));
  app.use('/api/transactions', createTransactionsRouter(db));
  app.use('/api/prices', createPricesRouter(db));
  app.use('/api/flat-valuations', createFlatValuationsRouter(db));

  return app;
}

module.exports = { createApp };
