# Portfolio Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal portfolio tracker web app that authenticates a single user, tracks stocks/crypto/flat/other assets with real-time prices, shows P&L in USD and percentage, and deploys on Railway from GitHub.

**Architecture:** Express backend serves both API routes and the built React frontend as static files — one Railway service, one URL. SQLite (better-sqlite3) is stored on Railway's persistent disk. Yahoo Finance and CoinGecko provide live prices, cached in the DB for 5 minutes.

**Tech Stack:** Node.js 20, Express 4, better-sqlite3, jsonwebtoken, bcrypt, express-rate-limit, yahoo-finance2, axios (CoinGecko), React 18, Vite 5, react-router-dom 6, vitest, supertest

---

## File Map

```
profolio-viewer/
├── package.json                        # root: workspaces + shared scripts
├── .gitignore
├── .env.example
├── railway.toml                        # Railway deployment config
│
├── server/
│   ├── package.json
│   ├── index.js                        # entry: runs migrations, seed, starts server
│   ├── app.js                          # Express app setup (export for tests)
│   ├── db/
│   │   ├── database.js                 # SQLite singleton
│   │   ├── migrations.js               # CREATE TABLE IF NOT EXISTS
│   │   └── seed.js                     # seed user if none exists
│   ├── middleware/
│   │   └── auth.js                     # verifyJwt middleware
│   ├── routes/
│   │   ├── auth.js                     # POST /api/auth/login, POST /api/auth/logout
│   │   ├── assets.js                   # POST /api/assets, DELETE /api/assets/:id
│   │   ├── transactions.js             # POST /api/transactions, GET /api/transactions/:assetId
│   │   ├── portfolio.js                # GET /api/portfolio
│   │   ├── prices.js                   # GET /api/prices/:symbol
│   │   └── flatValuations.js           # POST /api/flat-valuations
│   ├── services/
│   │   ├── pnl.js                      # pure P&L calculation functions
│   │   ├── priceService.js             # cache check + batch fetch orchestration
│   │   ├── yahooFinance.js             # Yahoo Finance batch fetch
│   │   └── coinGecko.js               # CoinGecko batch fetch
│   └── tests/
│       ├── setup.js                    # test DB setup helper
│       ├── auth.test.js
│       ├── pnl.test.js
│       ├── priceService.test.js
│       ├── portfolio.test.js
│       ├── assets.test.js
│       └── transactions.test.js
│
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                     # routes: /login, /, /assets/:id
│       ├── api.js                      # fetch wrapper + all API calls
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── DashboardPage.jsx
│       │   └── TransactionHistoryPage.jsx
│       └── components/
│           ├── SummaryBar.jsx          # total value + total P&L
│           ├── AssetTable.jsx          # per-asset rows with P&L
│           ├── AddAssetModal.jsx       # add asset + first transaction
│           └── AddValuationModal.jsx   # add flat/other valuation
│
└── docs/
    └── superpowers/
        ├── specs/2026-04-30-portfolio-viewer-design.md
        └── plans/2026-04-30-portfolio-viewer.md
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server/package.json`
- Create: `client/package.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "profolio-viewer",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "build": "npm run build --workspace=client",
    "start": "npm run start --workspace=server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create server/package.json**

```json
{
  "name": "server",
  "version": "1.0.0",
  "type": "commonjs",
  "main": "index.js",
  "scripts": {
    "dev": "node --watch index.js",
    "start": "node index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "bcrypt": "^5.1.1",
    "better-sqlite3": "^9.6.0",
    "cookie-parser": "^1.4.6",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "jsonwebtoken": "^9.0.2",
    "yahoo-finance2": "^2.11.3"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Create client/package.json**

```json
{
  "name": "client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.db
*.db-shm
*.db-wal
/data/
```

- [ ] **Step 5: Create .env.example**

```
JWT_SECRET=replace-with-a-long-random-string
SEED_USERNAME=admin
SEED_PASSWORD=replace-with-a-strong-password
NODE_ENV=development
DB_PATH=./portfolio.db
PORT=3001
```

- [ ] **Step 6: Create .env from .env.example with real local values**

Copy `.env.example` to `.env` and fill in real values for local development.

- [ ] **Step 7: Install dependencies**

```bash
cd F:/PROJECTS/profolio_viewer
npm install
```

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore .env.example server/package.json client/package.json
git commit -m "chore: project scaffold with workspaces"
```

---

## Task 2: Database Layer

**Files:**
- Create: `server/db/database.js`
- Create: `server/db/migrations.js`
- Create: `server/db/seed.js`
- Create: `server/tests/setup.js`

- [ ] **Step 1: Write the failing test for migrations**

Create `server/tests/setup.js`:
```js
const Database = require('better-sqlite3');

function createTestDb() {
  // in-memory DB for tests
  const db = new Database(':memory:');
  return db;
}

module.exports = { createTestDb };
```

Create `server/tests/migrations.test.js`:
```js
const { describe, it, expect, beforeEach } = require('vitest');
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/migrations.test.js
```
Expected: FAIL — `Cannot find module '../db/migrations'`

- [ ] **Step 3: Create server/db/database.js**

```js
require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../portfolio.db');

let _db;
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}

module.exports = { getDb };
```

- [ ] **Step 4: Create server/db/migrations.js**

```js
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
      date DATE NOT NULL
    );
  `);
}

module.exports = { runMigrations };
```

- [ ] **Step 5: Run migrations test to verify it passes**

```bash
cd server && npx vitest run tests/migrations.test.js
```
Expected: all 6 tests PASS

- [ ] **Step 6: Create server/db/seed.js**

```js
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
```

- [ ] **Step 7: Commit**

```bash
git add server/db/ server/tests/
git commit -m "feat: database migrations and seed"
```

---

## Task 3: Auth Middleware and Routes

**Files:**
- Create: `server/middleware/auth.js`
- Create: `server/routes/auth.js`
- Create: `server/app.js` (partial — enough to test auth routes)
- Create: `server/tests/auth.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/auth.test.js`:
```js
const { describe, it, expect, beforeAll } = require('vitest');
const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

let app, db;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';
  process.env.SEED_USERNAME = 'testuser';
  process.env.SEED_PASSWORD = 'testpass123';
  db = createTestDb();
  runMigrations(db);
  await seedUser(db);
  app = createApp(db);
});

describe('POST /api/auth/login', () => {
  it('returns 200 and sets cookie with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.ok).toBe(true);
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with unknown user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'testpass123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fields missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the auth cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass123' });
    const cookie = loginRes.headers['set-cookie'][0];

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);
    // cookie cleared means Max-Age=0 or Expires in the past
    expect(logoutRes.headers['set-cookie'][0]).toMatch(/token=;|Max-Age=0/);
  });
});

describe('Protected route without cookie', () => {
  it('returns 401', async () => {
    const res = await request(app).get('/api/portfolio');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/auth.test.js
```
Expected: FAIL — `Cannot find module '../app'`

- [ ] **Step 3: Create server/middleware/auth.js**

```js
const jwt = require('jsonwebtoken');

function verifyJwt(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { verifyJwt };
```

- [ ] **Step 4: Create server/routes/auth.js**

```js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

function createAuthRouter(db) {
  const router = express.Router();

  router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAuthRouter };
```

- [ ] **Step 5: Create server/app.js (minimal — enough to pass auth tests)**

```js
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
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
```

- [ ] **Step 6: Run auth tests to verify they pass**

```bash
cd server && npx vitest run tests/auth.test.js
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/middleware/ server/routes/auth.js server/app.js server/tests/auth.test.js
git commit -m "feat: auth routes with JWT cookie and rate limiting"
```

---

## Task 4: P&L Calculation Service

**Files:**
- Create: `server/services/pnl.js`
- Create: `server/tests/pnl.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/pnl.test.js`:
```js
const { describe, it, expect } = require('vitest');
const { calcStockPnl, calcFlatPnl, roundUsd } = require('../services/pnl');

describe('calcStockPnl', () => {
  const transactions = [
    { action: 'buy',  quantity: 10, price_usd: 100 },
    { action: 'buy',  quantity: 5,  price_usd: 120 },
    { action: 'sell', quantity: 3,  price_usd: 130 },
  ];

  it('calculates avg_buy_price correctly', () => {
    const result = calcStockPnl(transactions, 150);
    // (10*100 + 5*120) / 15 = 1600/15 ≈ 106.67
    expect(result.avg_buy_price).toBeCloseTo(106.67, 1);
  });

  it('calculates net_quantity correctly', () => {
    const result = calcStockPnl(transactions, 150);
    expect(result.net_quantity).toBe(12);
  });

  it('calculates current_value correctly', () => {
    const result = calcStockPnl(transactions, 150);
    expect(result.current_value).toBeCloseTo(12 * 150, 2);
  });

  it('calculates unrealized_pnl correctly', () => {
    const result = calcStockPnl(transactions, 150);
    // (150 - 106.67) * 12 ≈ 520
    expect(result.pnl_usd).toBeGreaterThan(0);
  });

  it('handles closed position (net_quantity = 0)', () => {
    const closedTx = [
      { action: 'buy',  quantity: 5, price_usd: 100 },
      { action: 'sell', quantity: 5, price_usd: 150 },
    ];
    const result = calcStockPnl(closedTx, 200);
    expect(result.net_quantity).toBe(0);
    expect(result.is_closed).toBe(true);
    // realized_pnl = 5*150 - 5*100 = 250
    expect(result.pnl_usd).toBeCloseTo(250, 2);
    expect(result.current_value).toBe(0);
  });

  it('returns null fields when no current_price', () => {
    const result = calcStockPnl(transactions, null);
    expect(result.current_value).toBeNull();
    expect(result.pnl_usd).toBeNull();
    expect(result.pnl_pct).toBeNull();
  });
});

describe('calcFlatPnl', () => {
  it('calculates P&L from first to latest valuation', () => {
    const valuations = [
      { value_usd: 300000, date: '2020-01-01' },
      { value_usd: 350000, date: '2022-06-01' },
      { value_usd: 400000, date: '2024-01-01' },
    ];
    const result = calcFlatPnl(valuations);
    expect(result.cost_basis).toBe(300000);
    expect(result.current_value).toBe(400000);
    expect(result.pnl_usd).toBeCloseTo(100000, 2);
    expect(result.pnl_pct).toBeCloseTo(33.33, 1);
  });

  it('returns P&L of 0 when only one valuation', () => {
    const result = calcFlatPnl([{ value_usd: 300000, date: '2020-01-01' }]);
    expect(result.pnl_usd).toBe(0);
    expect(result.current_value).toBe(300000);
  });

  it('returns nulls when no valuations', () => {
    const result = calcFlatPnl([]);
    expect(result.current_value).toBeNull();
    expect(result.pnl_usd).toBeNull();
  });
});

describe('roundUsd', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundUsd(1.005)).toBe(1.01);
    expect(roundUsd(1.004)).toBe(1.00);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/pnl.test.js
```
Expected: FAIL — `Cannot find module '../services/pnl'`

- [ ] **Step 3: Implement server/services/pnl.js**

```js
function roundUsd(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate P&L for stock/crypto assets.
 * @param {Array} transactions — array of {action, quantity, price_usd}
 * @param {number|null} currentPrice — current market price (null if unavailable)
 */
function calcStockPnl(transactions, currentPrice) {
  let totalBuyQty = 0;
  let totalBuyCost = 0;
  let totalSellQty = 0;
  let totalSellProceeds = 0;

  for (const tx of transactions) {
    if (tx.action === 'buy') {
      totalBuyQty += tx.quantity;
      totalBuyCost += tx.quantity * tx.price_usd;
    } else {
      totalSellQty += tx.quantity;
      totalSellProceeds += tx.quantity * tx.price_usd;
    }
  }

  const netQuantity = totalBuyQty - totalSellQty;
  const avgBuyPrice = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;
  const isClosed = netQuantity === 0;

  if (isClosed) {
    const realizedPnl = totalSellProceeds - totalBuyCost;
    return {
      net_quantity: 0,
      avg_buy_price: roundUsd(avgBuyPrice),
      current_value: 0,
      pnl_usd: roundUsd(realizedPnl),
      pnl_pct: totalBuyCost > 0 ? roundUsd((realizedPnl / totalBuyCost) * 100) : null,
      is_closed: true,
    };
  }

  if (currentPrice === null || currentPrice === undefined) {
    return {
      net_quantity: netQuantity,
      avg_buy_price: roundUsd(avgBuyPrice),
      current_value: null,
      pnl_usd: null,
      pnl_pct: null,
      is_closed: false,
    };
  }

  const currentValue = netQuantity * currentPrice;
  const unrealizedPnl = (currentPrice - avgBuyPrice) * netQuantity;
  const pnlPct = avgBuyPrice > 0 ? (unrealizedPnl / (avgBuyPrice * netQuantity)) * 100 : null;

  return {
    net_quantity: netQuantity,
    avg_buy_price: roundUsd(avgBuyPrice),
    current_value: roundUsd(currentValue),
    pnl_usd: roundUsd(unrealizedPnl),
    pnl_pct: pnlPct !== null ? roundUsd(pnlPct) : null,
    is_closed: false,
  };
}

/**
 * Calculate P&L for flat/other assets using manual valuations.
 * @param {Array} valuations — array of {value_usd, date}, unsorted
 */
function calcFlatPnl(valuations) {
  if (!valuations || valuations.length === 0) {
    return { cost_basis: null, current_value: null, pnl_usd: null, pnl_pct: null };
  }

  const sorted = [...valuations].sort((a, b) => a.date.localeCompare(b.date));
  const costBasis = sorted[0].value_usd;
  const currentValue = sorted[sorted.length - 1].value_usd;
  const pnlUsd = currentValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnlUsd / costBasis) * 100 : null;

  return {
    cost_basis: roundUsd(costBasis),
    current_value: roundUsd(currentValue),
    pnl_usd: roundUsd(pnlUsd),
    pnl_pct: pnlPct !== null ? roundUsd(pnlPct) : null,
  };
}

module.exports = { calcStockPnl, calcFlatPnl, roundUsd };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx vitest run tests/pnl.test.js
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/pnl.js server/tests/pnl.test.js
git commit -m "feat: P&L calculation service with full test coverage"
```

---

## Task 5: Price Services

**Files:**
- Create: `server/services/yahooFinance.js`
- Create: `server/services/coinGecko.js`
- Create: `server/services/priceService.js`
- Create: `server/tests/priceService.test.js`

- [ ] **Step 1: Write failing tests**

Create `server/tests/priceService.test.js`:
```js
const { describe, it, expect, beforeEach, vi } = require('vitest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');

// Mock the fetcher modules BEFORE importing priceService
vi.mock('../services/yahooFinance', () => ({
  fetchStockPrices: vi.fn(),
}));
vi.mock('../services/coinGecko', () => ({
  fetchCryptoPrices: vi.fn(),
}));

const { fetchStockPrices } = require('../services/yahooFinance');
const { fetchCryptoPrices } = require('../services/coinGecko');
const { getPortfolioPrices } = require('../services/priceService');

describe('getPortfolioPrices', () => {
  let db;
  beforeEach(() => {
    db = createTestDb();
    runMigrations(db);
    vi.clearAllMocks();
  });

  it('returns cached price if fresh (< 5 min old)', async () => {
    const freshTime = new Date(Date.now() - 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 150, freshTime);

    fetchStockPrices.mockResolvedValue({});
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBe(150);
    expect(result['AAPL'].stale).toBe(false);
    expect(fetchStockPrices).not.toHaveBeenCalled();
  });

  it('fetches fresh price when cache is stale (> 5 min old)', async () => {
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 140, staleTime);

    fetchStockPrices.mockResolvedValue({ AAPL: 155 });
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBe(155);
    expect(result['AAPL'].stale).toBe(false);
  });

  it('returns stale cached price when fetch fails', async () => {
    const staleTime = new Date(Date.now() - 10 * 60_000).toISOString();
    db.prepare('INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?,?,?)').run('AAPL', 140, staleTime);

    fetchStockPrices.mockRejectedValue(new Error('network error'));
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBe(140);
    expect(result['AAPL'].stale).toBe(true);
  });

  it('returns null price with stale flag when no cache and fetch fails', async () => {
    fetchStockPrices.mockRejectedValue(new Error('network error'));
    const result = await getPortfolioPrices(db, [{ symbol: 'AAPL', type: 'stock' }]);
    expect(result['AAPL'].price_usd).toBeNull();
    expect(result['AAPL'].stale).toBe(true);
  });

  it('skips price fetch for flat/other assets', async () => {
    const result = await getPortfolioPrices(db, [{ symbol: 'My Flat', type: 'flat' }]);
    expect(result['My Flat']).toBeUndefined();
    expect(fetchStockPrices).not.toHaveBeenCalled();
    expect(fetchCryptoPrices).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/priceService.test.js
```
Expected: FAIL — modules not found

- [ ] **Step 3: Create server/services/yahooFinance.js**

```js
const yahooFinance = require('yahoo-finance2');

/**
 * Fetch current prices for a list of stock symbols.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, number>>} symbol -> price map
 */
async function fetchStockPrices(symbols) {
  if (!symbols.length) return {};
  const results = {};
  // yahoo-finance2 supports individual quotes; batch via Promise.all
  const quotes = await Promise.allSettled(
    symbols.map(s => yahooFinance.quote(s, { fields: ['regularMarketPrice'] }))
  );
  quotes.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value?.regularMarketPrice) {
      results[symbols[i]] = result.value.regularMarketPrice;
    }
  });
  return results;
}

module.exports = { fetchStockPrices };
```

- [ ] **Step 4: Create server/services/coinGecko.js**

```js
const axios = require('axios');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Fetch current USD prices for a list of crypto symbols (e.g. ['BTC','ETH']).
 * CoinGecko uses lowercase coin IDs — we map common tickers to IDs.
 * Unknown symbols are silently skipped.
 * @param {string[]} symbols
 * @returns {Promise<Record<string, number>>} symbol -> price map (keys in original case)
 */
async function fetchCryptoPrices(symbols) {
  if (!symbols.length) return {};

  // CoinGecko uses coin IDs (e.g. 'bitcoin', 'ethereum')
  // For simplicity: try symbol as-is lowercased as CoinGecko ID
  const ids = symbols.map(s => s.toLowerCase());

  const url = `${COINGECKO_BASE}/simple/price`;
  const res = await axios.get(url, {
    params: { ids: ids.join(','), vs_currencies: 'usd' },
    timeout: 10000,
  });

  const results = {};
  symbols.forEach(symbol => {
    const id = symbol.toLowerCase();
    if (res.data[id]?.usd) {
      results[symbol] = res.data[id].usd;
    }
  });
  return results;
}

module.exports = { fetchCryptoPrices };
```

- [ ] **Step 5: Create server/services/priceService.js**

```js
const { fetchStockPrices } = require('./yahooFinance');
const { fetchCryptoPrices } = require('./coinGecko');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get prices for a list of assets, using cache where fresh.
 * @param {object} db — better-sqlite3 instance
 * @param {Array<{symbol: string, type: string}>} assets
 * @returns {Promise<Record<string, {price_usd, stale, updated_at}>>}
 */
async function getPortfolioPrices(db, assets) {
  const now = Date.now();
  const result = {};
  const staleStocks = [];
  const staleCrypto = [];

  for (const { symbol, type } of assets) {
    if (type === 'flat' || type === 'other') continue;

    const cached = db.prepare('SELECT price_usd, updated_at FROM prices_cache WHERE symbol = ?').get(symbol);
    const isFresh = cached && (now - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS;

    if (isFresh) {
      result[symbol] = { price_usd: cached.price_usd, stale: false, updated_at: cached.updated_at };
    } else {
      // needs refresh — collect by type
      if (type === 'stock') staleStocks.push(symbol);
      else if (type === 'crypto') staleCrypto.push(symbol);
      // store existing cache as fallback
      result[symbol] = cached
        ? { price_usd: cached.price_usd, stale: true, updated_at: cached.updated_at }
        : { price_usd: null, stale: true, updated_at: null };
    }
  }

  // Batch fetch stale stocks
  if (staleStocks.length) {
    try {
      const fresh = await fetchStockPrices(staleStocks);
      _updateCache(db, fresh, result);
    } catch {
      // keep stale fallback already set above
    }
  }

  // Batch fetch stale crypto
  if (staleCrypto.length) {
    try {
      const fresh = await fetchCryptoPrices(staleCrypto);
      _updateCache(db, fresh, result);
    } catch {
      // keep stale fallback
    }
  }

  return result;
}

function _updateCache(db, freshPrices, result) {
  const updatedAt = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO prices_cache (symbol, price_usd, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET price_usd = excluded.price_usd, updated_at = excluded.updated_at
  `);
  for (const [symbol, price] of Object.entries(freshPrices)) {
    upsert.run(symbol, price, updatedAt);
    result[symbol] = { price_usd: price, stale: false, updated_at: updatedAt };
  }
}

module.exports = { getPortfolioPrices };
```

- [ ] **Step 6: Run price service tests**

```bash
cd server && npx vitest run tests/priceService.test.js
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/services/ server/tests/priceService.test.js
git commit -m "feat: price services with Yahoo Finance, CoinGecko, and 5-min cache"
```

---

## Task 6: Portfolio and Asset API Routes

**Files:**
- Create: `server/routes/portfolio.js`
- Create: `server/routes/assets.js`
- Create: `server/routes/transactions.js`
- Create: `server/routes/prices.js`
- Create: `server/routes/flatValuations.js`
- Create: `server/tests/portfolio.test.js`
- Create: `server/tests/assets.test.js`
- Create: `server/tests/transactions.test.js`

- [ ] **Step 1: Write failing test for portfolio route**

Create `server/tests/portfolio.test.js`:
```js
const { describe, it, expect, beforeAll, vi } = require('vitest');
const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

vi.mock('../services/priceService', () => ({
  getPortfolioPrices: vi.fn().mockResolvedValue({}),
}));

let app, db, cookie;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';
  process.env.SEED_USERNAME = 'testuser';
  process.env.SEED_PASSWORD = 'testpass123';
  db = createTestDb();
  runMigrations(db);
  await seedUser(db);
  app = createApp(db);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testuser', password: 'testpass123' });
  cookie = loginRes.headers['set-cookie'][0];
});

describe('GET /api/portfolio', () => {
  it('returns empty portfolio when no assets', async () => {
    const res = await request(app).get('/api/portfolio').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.assets).toEqual([]);
    expect(res.body.total_value).toBe(0);
    expect(res.body.total_pnl_usd).toBe(0);
  });

  it('includes added asset in portfolio', async () => {
    db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'AAPL', 'Apple');
    const assetId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)').run(assetId, 'buy', 10, 100, '2024-01-01');

    const { getPortfolioPrices } = require('../services/priceService');
    getPortfolioPrices.mockResolvedValue({ AAPL: { price_usd: 150, stale: false, updated_at: new Date().toISOString() } });

    const res = await request(app).get('/api/portfolio').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.assets).toHaveLength(1);
    expect(res.body.assets[0].symbol).toBe('AAPL');
    expect(res.body.assets[0].current_price).toBe(150);
    expect(res.body.assets[0].pnl_usd).toBeCloseTo(500, 1);
    expect(res.body.total_value).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run tests/portfolio.test.js
```
Expected: FAIL

- [ ] **Step 3: Create server/routes/portfolio.js**

```js
const express = require('express');
const { getPortfolioPrices } = require('../services/priceService');
const { calcStockPnl, calcFlatPnl, roundUsd } = require('../services/pnl');

function createPortfolioRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const assets = db.prepare('SELECT * FROM assets ORDER BY created_at ASC').all();

    const priceMap = await getPortfolioPrices(db, assets);

    let totalValue = 0;
    let totalPnlUsd = 0;
    let totalCostBasis = 0; // tracked separately for accurate pnl%

    const enriched = assets.map(asset => {
      if (asset.type === 'stock' || asset.type === 'crypto') {
        const txs = db.prepare('SELECT * FROM transactions WHERE asset_id = ?').all(asset.id);
        const priceInfo = priceMap[asset.symbol] || { price_usd: null, stale: true };
        const pnl = calcStockPnl(txs, priceInfo.price_usd);

        if (!pnl.is_closed && pnl.current_value !== null) totalValue += pnl.current_value;
        if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
        // cost basis = avg_buy_price * net_quantity (open) or total buy cost (closed)
        if (pnl.avg_buy_price != null) {
          totalCostBasis += pnl.is_closed
            ? (pnl.avg_buy_price * txs.filter(t => t.action === 'buy').reduce((s, t) => s + t.quantity, 0))
            : (pnl.avg_buy_price * pnl.net_quantity);
        }

        return {
          ...asset,
          current_price: priceInfo.price_usd,
          price_stale: priceInfo.stale,
          price_updated_at: priceInfo.updated_at,
          ...pnl,
        };
      }

      if (asset.type === 'flat' || asset.type === 'other') {
        const valuations = db.prepare('SELECT * FROM flat_valuations WHERE asset_id = ?').all(asset.id);
        const pnl = calcFlatPnl(valuations);

        if (pnl.current_value !== null) totalValue += pnl.current_value;
        if (pnl.pnl_usd !== null) totalPnlUsd += pnl.pnl_usd;
        if (pnl.cost_basis !== null) totalCostBasis += pnl.cost_basis;

        return { ...asset, ...pnl };
      }

      return asset;
    });

    const pnlPct = totalCostBasis > 0
      ? roundUsd((totalPnlUsd / totalCostBasis) * 100)
      : null;

    res.json({
      assets: enriched,
      total_value: roundUsd(totalValue),
      total_pnl_usd: roundUsd(totalPnlUsd),
      total_pnl_pct: pnlPct,
    });
  });

  return router;
}

module.exports = { createPortfolioRouter };
```

- [ ] **Step 4: Create server/routes/assets.js**

```js
const express = require('express');

const VALID_TYPES = ['stock', 'crypto', 'flat', 'other'];

function createAssetsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { type, symbol, name } = req.body;
    if (!type || !symbol || !name) {
      return res.status(400).json({ error: 'type, symbol, and name are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const result = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?, ?, ?)').run(type, symbol.toUpperCase(), name);
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(asset);
  });

  router.delete('/:id', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAssetsRouter };
```

- [ ] **Step 5: Create server/routes/transactions.js**

```js
const express = require('express');

function createTransactionsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, action, quantity, price_usd, date } = req.body;
    if (!asset_id || !action || !quantity || !price_usd || !date) {
      return res.status(400).json({ error: 'asset_id, action, quantity, price_usd, date are required' });
    }
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'action must be buy or sell' });
    }

    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const result = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)'
    ).run(asset_id, action, quantity, price_usd, date);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.get('/:assetId', (req, res) => {
    const txs = db.prepare(
      'SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.params.assetId);
    res.json(txs);
  });

  return router;
}

module.exports = { createTransactionsRouter };
```

- [ ] **Step 6: Create server/routes/prices.js**

```js
const express = require('express');
const { getPortfolioPrices } = require('../services/priceService');

function createPricesRouter(db) {
  const router = express.Router();

  router.get('/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const type = req.query.type || 'stock';
    const prices = await getPortfolioPrices(db, [{ symbol, type }]);
    const info = prices[symbol] || { price_usd: null, stale: true };
    res.json({ symbol, ...info });
  });

  return router;
}

module.exports = { createPricesRouter };
```

- [ ] **Step 7: Create server/routes/flatValuations.js**

```js
const express = require('express');

function createFlatValuationsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, value_usd, date } = req.body;
    if (!asset_id || value_usd == null || !date) {
      return res.status(400).json({ error: 'asset_id, value_usd, and date are required' });
    }

    const asset = db.prepare("SELECT id, type FROM assets WHERE id = ?").get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (!['flat', 'other'].includes(asset.type)) {
      return res.status(400).json({ error: 'Valuations can only be added to flat or other assets' });
    }

    const result = db.prepare(
      'INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)'
    ).run(asset_id, value_usd, date);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  return router;
}

module.exports = { createFlatValuationsRouter };
```

- [ ] **Step 8: Update server/app.js to wire all routes**

Replace the contents of `server/app.js`:
```js
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
```

- [ ] **Step 9: Run portfolio test**

```bash
cd server && npx vitest run tests/portfolio.test.js
```
Expected: PASS

- [ ] **Step 10: Create server/tests/transactions.test.js**

```js
const { describe, it, expect, beforeAll } = require('vitest');
const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

let app, db, cookie, assetId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';
  process.env.SEED_USERNAME = 'testuser';
  process.env.SEED_PASSWORD = 'testpass123';
  db = createTestDb();
  runMigrations(db);
  await seedUser(db);
  app = createApp(db);
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'testuser', password: 'testpass123' });
  cookie = loginRes.headers['set-cookie'][0];
  const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('stock', 'AAPL', 'Apple');
  assetId = ins.lastInsertRowid;
});

describe('POST /api/transactions', () => {
  it('creates a buy transaction', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'buy', quantity: 5, price_usd: 150, date: '2024-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('rejects invalid action', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: assetId, action: 'hold', quantity: 5, price_usd: 150, date: '2024-01-01' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown asset', async () => {
    const res = await request(app).post('/api/transactions').set('Cookie', cookie)
      .send({ asset_id: 99999, action: 'buy', quantity: 5, price_usd: 150, date: '2024-01-01' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/transactions/:assetId', () => {
  it('returns transactions sorted by date desc', async () => {
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)').run(assetId, 'buy', 2, 120, '2023-06-01');
    const res = await request(app).get(`/api/transactions/${assetId}`).set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // sorted desc by date
    const dates = res.body.map(t => t.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });
});
```

- [ ] **Step 11: Create server/tests/assets.test.js**

```js
const { describe, it, expect, beforeAll } = require('vitest');
const request = require('supertest');
const { createTestDb } = require('./setup');
const { runMigrations } = require('../db/migrations');
const { seedUser } = require('../db/seed');
const { createApp } = require('../app');

let app, db, cookie;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';
  process.env.SEED_USERNAME = 'testuser';
  process.env.SEED_PASSWORD = 'testpass123';
  db = createTestDb();
  runMigrations(db);
  await seedUser(db);
  app = createApp(db);
  const loginRes = await request(app).post('/api/auth/login').send({ username: 'testuser', password: 'testpass123' });
  cookie = loginRes.headers['set-cookie'][0];
});

describe('POST /api/assets', () => {
  it('creates an asset', async () => {
    const res = await request(app).post('/api/assets').set('Cookie', cookie)
      .send({ type: 'stock', symbol: 'TSLA', name: 'Tesla' });
    expect(res.status).toBe(201);
    expect(res.body.symbol).toBe('TSLA');
  });

  it('rejects invalid type', async () => {
    const res = await request(app).post('/api/assets').set('Cookie', cookie)
      .send({ type: 'banana', symbol: 'BAN', name: 'Banana' });
    expect(res.status).toBe(400);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/assets').set('Cookie', cookie).send({ type: 'stock' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/assets/:id', () => {
  it('deletes an asset and its transactions', async () => {
    const ins = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?,?,?)').run('crypto', 'BTC', 'Bitcoin');
    const id = ins.lastInsertRowid;
    db.prepare('INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)').run(id, 'buy', 1, 60000, '2024-01-01');

    const res = await request(app).delete(`/api/assets/${id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);

    const txs = db.prepare('SELECT * FROM transactions WHERE asset_id = ?').all(id);
    expect(txs).toHaveLength(0); // cascade deleted
  });

  it('returns 404 for unknown asset', async () => {
    const res = await request(app).delete('/api/assets/99999').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 12: Run all server tests**

```bash
cd server && npx vitest run
```
Expected: all tests PASS

- [ ] **Step 13: Commit**

```bash
git add server/routes/ server/app.js server/tests/
git commit -m "feat: portfolio, assets, transactions, prices, and flat-valuations API routes"
```

---

## Task 7: Server Entry Point

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Create server/index.js**

```js
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
```

- [ ] **Step 2: Test server starts locally**

```bash
cd server && node index.js
```
Expected: `Server running on port 3001` with no errors. Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: server entry point with migrations and seed on startup"
```

---

## Task 8: React Client Scaffold

**Files:**
- Create: `client/vite.config.js`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/api.js`

- [ ] **Step 1: Create client/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 2: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portfolio Viewer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create client/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Create client/src/App.jsx**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assets/:assetId" element={<TransactionHistoryPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 5: Create client/src/api.js**

```js
async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include', // send cookies
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: { username, password } }),

  logout: () =>
    apiFetch('/api/auth/logout', { method: 'POST' }),

  getPortfolio: () =>
    apiFetch('/api/portfolio'),

  addAsset: (data) =>
    apiFetch('/api/assets', { method: 'POST', body: data }),

  deleteAsset: (id) =>
    apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),

  addTransaction: (data) =>
    apiFetch('/api/transactions', { method: 'POST', body: data }),

  getTransactions: (assetId) =>
    apiFetch(`/api/transactions/${assetId}`),

  addValuation: (data) =>
    apiFetch('/api/flat-valuations', { method: 'POST', body: data }),

  getPrice: (symbol, type) =>
    apiFetch(`/api/prices/${symbol}?type=${type}`),
};
```

- [ ] **Step 6: Verify client dev server starts**

Open a second terminal:
```bash
cd server && node index.js
```
```bash
cd client && npx vite
```
Expected: Vite dev server starts at `http://localhost:5173`. Browser shows blank page (no pages yet). No console errors.

- [ ] **Step 7: Commit**

```bash
git add client/
git commit -m "feat: React client scaffold with Vite, routing, and API wrapper"
```

---

## Task 9: Login Page

**Files:**
- Create: `client/src/pages/LoginPage.jsx`

- [ ] **Step 1: Create client/src/pages/LoginPage.jsx**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Portfolio Viewer</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' },
  card: { background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '320px' },
  title: { margin: '0 0 1.5rem', fontSize: '1.5rem', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' },
  button: { padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer' },
  error: { color: '#dc2626', margin: 0, fontSize: '0.875rem' },
};
```

- [ ] **Step 2: Test in browser**

Navigate to `http://localhost:5173/login`. You should see a login form. Submit with `SEED_USERNAME`/`SEED_PASSWORD` — should redirect to `/` (dashboard, currently blank).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LoginPage.jsx
git commit -m "feat: login page"
```

---

## Task 10: Dashboard Page — Summary Bar and Asset Table

**Files:**
- Create: `client/src/components/SummaryBar.jsx`
- Create: `client/src/components/AssetTable.jsx`
- Create: `client/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Create client/src/components/SummaryBar.jsx**

```jsx
export default function SummaryBar({ totalValue, totalPnlUsd, totalPnlPct }) {
  const pnlColor = totalPnlUsd >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div style={styles.bar}>
      <div style={styles.item}>
        <span style={styles.label}>Total Value</span>
        <span style={styles.value}>${(totalValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div style={styles.item}>
        <span style={styles.label}>Total P&L</span>
        <span style={{ ...styles.value, color: pnlColor }}>
          {totalPnlUsd >= 0 ? '+' : ''}${(totalPnlUsd ?? 0).toFixed(2)}
          {totalPnlPct != null && ` (${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct}%)`}
        </span>
      </div>
    </div>
  );
}

const styles = {
  bar: { display: 'flex', gap: '2rem', padding: '1rem 1.5rem', background: '#1e293b', color: '#fff', borderRadius: '8px', marginBottom: '1.5rem' },
  item: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  value: { fontSize: '1.5rem', fontWeight: '600' },
};
```

- [ ] **Step 2: Create client/src/components/AssetTable.jsx**

```jsx
import { useNavigate } from 'react-router-dom';

function PnlCell({ value, pct }) {
  if (value == null) return <td style={styles.td}>—</td>;
  const color = value >= 0 ? '#16a34a' : '#dc2626';
  return (
    <td style={{ ...styles.td, color }}>
      {value >= 0 ? '+' : ''}${value.toFixed(2)}
      {pct != null && <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>({pct >= 0 ? '+' : ''}{pct}%)</span>}
    </td>
  );
}

export default function AssetTable({ assets, onDelete, onAddValuation }) {
  const navigate = useNavigate();

  if (!assets.length) {
    return <p style={{ color: '#64748b' }}>No assets yet. Click "Add Asset" to get started.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Name', 'Type', 'Symbol', 'Qty', 'Avg Buy', 'Current Price', 'Value', 'P&L', 'Last Updated', 'Actions'].map(h => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map(asset => (
            <tr
              key={asset.id}
              style={styles.row}
              onClick={() => navigate(`/assets/${asset.id}`)}
            >
              <td style={styles.td}>{asset.name}</td>
              <td style={styles.td}>{asset.type}</td>
              <td style={styles.td}><strong>{asset.symbol}</strong></td>
              <td style={styles.td}>{asset.net_quantity != null ? asset.net_quantity : '—'}</td>
              <td style={styles.td}>{asset.avg_buy_price != null ? `$${asset.avg_buy_price.toFixed(2)}` : '—'}</td>
              <td style={styles.td}>
                {asset.current_price != null
                  ? <span>
                      ${asset.current_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      {asset.price_stale && <span title="Price may be outdated" style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>}
                    </span>
                  : <span style={{ color: '#9ca3af' }} title="Symbol not found or fetch failed">—</span>
                }
              </td>
              <td style={styles.td}>{asset.current_value != null ? `$${asset.current_value.toLocaleString()}` : '—'}</td>
              <PnlCell value={asset.pnl_usd} pct={asset.pnl_pct} />
              <td style={{ ...styles.td, fontSize: '0.75rem', color: '#94a3b8' }}>
                {asset.price_updated_at ? new Date(asset.price_updated_at).toLocaleTimeString() : '—'}
              </td>
              <td style={styles.td} onClick={e => e.stopPropagation()}>
                {(asset.type === 'flat' || asset.type === 'other') && (
                  <button style={styles.actionBtn} onClick={() => onAddValuation(asset)}>+ Val</button>
                )}
                <button style={{ ...styles.actionBtn, color: '#dc2626' }} onClick={() => onDelete(asset.id)}>Del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { padding: '8px 12px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  row: { cursor: 'pointer', transition: 'background 0.1s' },
  actionBtn: { marginRight: '4px', padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', background: 'transparent', fontSize: '0.75rem' },
};
```

- [ ] **Step 3: Create client/src/pages/DashboardPage.jsx**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import SummaryBar from '../components/SummaryBar';
import AssetTable from '../components/AssetTable';
import AddAssetModal from '../components/AddAssetModal';
import AddValuationModal from '../components/AddValuationModal';

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [valuationAsset, setValuationAsset] = useState(null);
  const navigate = useNavigate();

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio();
      setPortfolio(data);
      setError('');
    } catch (err) {
      if (err?.message === 'Not authenticated') navigate('/login');
      else setError('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPortfolio();
    const interval = setInterval(loadPortfolio, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPortfolio]);

  async function handleDelete(assetId) {
    if (!confirm('Delete this asset and all its transactions?')) return;
    await api.deleteAsset(assetId);
    loadPortfolio();
  }

  async function handleLogout() {
    await api.logout();
    navigate('/login');
  }

  if (loading) return <div style={styles.center}>Loading…</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>Portfolio</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadPortfolio} style={styles.btn}>Refresh</button>
          <button onClick={() => setShowAddAsset(true)} style={{ ...styles.btn, background: '#2563eb', color: '#fff' }}>+ Add Asset</button>
          <button onClick={handleLogout} style={{ ...styles.btn, color: '#dc2626' }}>Logout</button>
        </div>
      </header>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {portfolio && (
        <>
          <SummaryBar
            totalValue={portfolio.total_value}
            totalPnlUsd={portfolio.total_pnl_usd}
            totalPnlPct={portfolio.total_pnl_pct}
          />
          <AssetTable
            assets={portfolio.assets}
            onDelete={handleDelete}
            onAddValuation={setValuationAsset}
          />
        </>
      )}

      {showAddAsset && (
        <AddAssetModal
          onClose={() => setShowAddAsset(false)}
          onSuccess={() => { setShowAddAsset(false); loadPortfolio(); }}
        />
      )}

      {valuationAsset && (
        <AddValuationModal
          asset={valuationAsset}
          onClose={() => setValuationAsset(null)}
          onSuccess={() => { setValuationAsset(null); loadPortfolio(); }}
        />
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading: { margin: 0, fontSize: '1.75rem' },
  btn: { padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', background: '#fff' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
};
```

- [ ] **Step 4: Test in browser**

Log in and navigate to `/`. You should see the dashboard with the summary bar and (empty) asset table.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/SummaryBar.jsx client/src/components/AssetTable.jsx client/src/pages/DashboardPage.jsx
git commit -m "feat: dashboard page with summary bar and asset table"
```

---

## Task 11: Add Asset Modal

**Files:**
- Create: `client/src/components/AddAssetModal.jsx`

- [ ] **Step 1: Create client/src/components/AddAssetModal.jsx**

```jsx
import { useState } from 'react';
import { api } from '../api';

const ASSET_TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function AddAssetModal({ onClose, onSuccess }) {
  const [type, setType] = useState('stock');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  // For stock/crypto: first transaction
  const [action, setAction] = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  // For flat/other: initial valuation
  const [valuationValue, setValuationValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isFlat = type === 'flat' || type === 'other';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const asset = await api.addAsset({ type, symbol, name });

      if (isFlat) {
        if (valuationValue) {
          await api.addValuation({ asset_id: asset.id, value_usd: parseFloat(valuationValue), date });
        }
      } else {
        if (quantity && price) {
          await api.addTransaction({ asset_id: asset.id, action, quantity: parseFloat(quantity), price_usd: parseFloat(price), date });
        }
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 1rem' }}>Add Asset</h2>
        <form onSubmit={handleSubmit} style={form}>
          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value)} style={input}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Symbol (e.g. AAPL, BTC, My Flat)">
            <input value={symbol} onChange={e => setSymbol(e.target.value)} required style={input} />
          </Field>
          <Field label="Display Name">
            <input value={name} onChange={e => setName(e.target.value)} required style={input} />
          </Field>

          {!isFlat && (
            <>
              <Field label="Action">
                <select value={action} onChange={e => setAction(e.target.value)} style={input}>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </Field>
              <Field label="Quantity">
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} style={input} />
              </Field>
              <Field label="Price per unit (USD)">
                <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} style={input} />
              </Field>
            </>
          )}

          {isFlat && (
            <Field label="Initial Valuation (USD)">
              <input type="number" step="any" value={valuationValue} onChange={e => setValuationValue(e.target.value)} style={input} />
            </Field>
          )}

          <Field label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={input} />
          </Field>

          {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>{loading ? 'Adding…' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.875rem', color: '#475569' }}>{label}</label>
      {children}
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modal = { background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '400px', maxHeight: '90vh', overflowY: 'auto' };
const form = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const input = { padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '1rem' };
const submitBtn = { padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const cancelBtn = { padding: '8px 20px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' };
```

- [ ] **Step 2: Test in browser**

Click "+ Add Asset" on the dashboard. Add a stock (e.g. AAPL, quantity 10, price 150). Confirm it appears in the asset table.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AddAssetModal.jsx
git commit -m "feat: add asset modal with transaction and valuation support"
```

---

## Task 12: Add Flat Valuation Modal

**Files:**
- Create: `client/src/components/AddValuationModal.jsx`

- [ ] **Step 1: Create client/src/components/AddValuationModal.jsx**

```jsx
import { useState } from 'react';
import { api } from '../api';

export default function AddValuationModal({ asset, onClose, onSuccess }) {
  const [valueUsd, setValueUsd] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.addValuation({ asset_id: asset.id, value_usd: parseFloat(valueUsd), date });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 1rem' }}>Add Valuation — {asset.name}</h2>
        <form onSubmit={handleSubmit} style={form}>
          <div style={field}>
            <label>Current Value (USD)</label>
            <input type="number" step="any" value={valueUsd} onChange={e => setValueUsd(e.target.value)} required style={inp} />
          </div>
          <div style={field}>
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inp} />
          </div>
          {error && <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modal = { background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '360px' };
const form = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const field = { display: 'flex', flexDirection: 'column', gap: '4px' };
const inp = { padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '1rem' };
const submitBtn = { padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const cancelBtn = { padding: '8px 20px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' };
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/AddValuationModal.jsx
git commit -m "feat: add valuation modal for flat/other assets"
```

---

## Task 13: Transaction History Page

**Files:**
- Create: `client/src/pages/TransactionHistoryPage.jsx`

- [ ] **Step 1: Create client/src/pages/TransactionHistoryPage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function TransactionHistoryPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTx, setShowAddTx] = useState(false);
  const [form, setForm] = useState({ action: 'buy', quantity: '', price_usd: '', date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');

  async function load() {
    try {
      const txs = await api.getTransactions(assetId);
      setTransactions(txs);
    } catch { navigate('/login'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [assetId]);

  async function handleAddTx(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addTransaction({ asset_id: parseInt(assetId), ...form, quantity: parseFloat(form.quantity), price_usd: parseFloat(form.price_usd) });
      setShowAddTx(false);
      load();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <div style={center}>Loading…</div>;

  return (
    <div style={page}>
      <button onClick={() => navigate('/')} style={backBtn}>← Back to Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Transaction History</h2>
        <button onClick={() => setShowAddTx(!showAddTx)} style={addBtn}>+ Add Transaction</button>
      </div>

      {showAddTx && (
        <form onSubmit={handleAddTx} style={txForm}>
          <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} style={inp}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <input placeholder="Quantity" type="number" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required style={inp} />
          <input placeholder="Price (USD)" type="number" step="any" value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))} required style={inp} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
          {error && <span style={{ color: '#dc2626' }}>{error}</span>}
          <button type="submit" style={submitBtn}>Save</button>
        </form>
      )}

      {transactions.length === 0
        ? <p style={{ color: '#64748b' }}>No transactions yet.</p>
        : (
          <table style={table}>
            <thead>
              <tr>
                {['Date', 'Action', 'Quantity', 'Price (USD)', 'Total (USD)'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={td}>{tx.date}</td>
                  <td style={{ ...td, color: tx.action === 'buy' ? '#16a34a' : '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>{tx.action}</td>
                  <td style={td}>{tx.quantity}</td>
                  <td style={td}>${tx.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={td}>${(tx.quantity * tx.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

const page = { maxWidth: '800px', margin: '0 auto', padding: '1.5rem' };
const center = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' };
const backBtn = { marginBottom: '1rem', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', background: '#fff' };
const addBtn = { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const txForm = { display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap', padding: '1rem', background: '#f8fafc', borderRadius: '6px' };
const inp = { padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' };
const submitBtn = { padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
const th = { padding: '8px 12px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' };
```

- [ ] **Step 2: Test in browser**

Click on an asset row in the dashboard. Verify transaction history page shows with a back button and the "+ Add Transaction" form works.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/TransactionHistoryPage.jsx
git commit -m "feat: transaction history page with add transaction form"
```

---

## Task 14: Deployment Configuration

**Files:**
- Create: `railway.toml`
- Modify: `package.json`

- [ ] **Step 1: Create railway.toml**

```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/api/auth/login"
healthcheckTimeout = 300

[[volumes]]
mountPath = "/data"
```

- [ ] **Step 2: Update root package.json build script**

The `build` script must install dependencies and build the React client. Ensure `package.json` has:

```json
{
  "scripts": {
    "build": "npm install --workspace=client && npm run build --workspace=client",
    "start": "npm run start --workspace=server"
  }
}
```

- [ ] **Step 3: Update server/index.js to use /data/portfolio.db in production**

In `.env.example`, the default `DB_PATH=./portfolio.db` is fine for local dev. For Railway, set `DB_PATH=/data/portfolio.db` in the Railway dashboard env vars. The `database.js` already reads `process.env.DB_PATH`, so no code change needed — just Railway config.

- [ ] **Step 4: Update client vite.config.js build output path**

Ensure `client/vite.config.js` does NOT override the default `dist` output directory (Vite default is `dist/`, which Express serves from `../client/dist` — this is correct as-is).

- [ ] **Step 5: Commit**

```bash
git add railway.toml package.json
git commit -m "chore: Railway deployment config and build scripts"
```

---

## Task 15: GitHub Setup and Final Validation

- [ ] **Step 1: Run full test suite**

```bash
cd server && npx vitest run
```
Expected: all tests PASS with no failures.

- [ ] **Step 2: Build the React client**

```bash
cd client && npx vite build
```
Expected: `dist/` folder created with no errors.

- [ ] **Step 3: Test production build locally**

```bash
# In server/.env, set NODE_ENV=production temporarily
cd server && NODE_ENV=production node index.js
```
Open `http://localhost:3001`. You should see the login page (served as static file from `client/dist`). Test login, dashboard, add asset, transaction history. Reset `NODE_ENV=development` afterwards.

- [ ] **Step 4: Create GitHub repository**

Go to GitHub.com → New repository → name it `profolio-viewer` → Public or Private → do NOT initialize with README (we already have commits).

- [ ] **Step 5: Push to GitHub**

```bash
cd F:/PROJECTS/profolio_viewer
git remote add origin https://github.com/YOUR_USERNAME/profolio-viewer.git
git branch -M main
git push -u origin main
```

- [ ] **Step 6: Deploy on Railway**

1. Go to railway.app → New Project → Deploy from GitHub repo → select `profolio-viewer`
2. Add a Volume: mount path `/data`
3. Set environment variables in Railway dashboard:
   - `JWT_SECRET` = (generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - `SEED_USERNAME` = your desired username
   - `SEED_PASSWORD` = your desired password
   - `DB_PATH` = `/data/portfolio.db`
   - `NODE_ENV` = `production`
4. Railway will auto-build and deploy. Check logs for `Server running on port ...`

- [ ] **Step 7: Verify live deployment**

Open the Railway-provided URL. Log in, add assets, verify prices load. Check that data persists after a page reload.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: final validation and deployment verified"
git push
```

---

## Summary

| Task | What it builds |
|---|---|
| 1 | Project scaffold |
| 2 | SQLite DB, migrations, seed |
| 3 | Auth routes + JWT middleware |
| 4 | P&L calculation (pure functions) |
| 5 | Price services (Yahoo, CoinGecko, cache) |
| 6 | All API routes (portfolio, assets, transactions, prices, flat valuations) |
| 7 | Server entry point |
| 8 | React + Vite scaffold + API wrapper |
| 9 | Login page |
| 10 | Dashboard (summary bar + asset table) |
| 11 | Add asset modal |
| 12 | Add flat valuation modal |
| 13 | Transaction history page |
| 14 | Railway deployment config |
| 15 | GitHub push + Railway deploy |
