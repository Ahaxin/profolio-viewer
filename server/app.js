const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
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

  // Public auth routes
  app.use('/api/auth', createAuthRouter(db));

  // All routes below require valid JWT
  app.use('/api', verifyJwt);
  app.use('/api/portfolio', createPortfolioRouter(db));
  app.use('/api/assets', createAssetsRouter(db));
  app.use('/api/transactions', createTransactionsRouter(db));
  app.use('/api/prices', createPricesRouter(db));
  app.use('/api/flat-valuations', createFlatValuationsRouter(db));

  // Serve built React app in production
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
