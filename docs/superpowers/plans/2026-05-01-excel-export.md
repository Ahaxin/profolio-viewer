# Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Export to Excel" button to the dashboard that downloads all transactions across all assets as a `.xlsx` file.

**Architecture:** A new `GET /api/transactions/export` endpoint returns JSON of all transactions joined with asset info. The dashboard fetches this data, uses SheetJS (`xlsx`) to generate a `.xlsx` file in the browser, and triggers a download — no file ever touches the server disk.

**Tech Stack:** Node.js/Express, better-sqlite3, React, SheetJS (`xlsx` npm package)

---

## File Map

| File | Action |
|------|--------|
| `server/routes/transactions.js` | Add `GET /export` handler before `GET /:assetId` |
| `server/tests/transactions.test.js` | Add 4 tests for the export endpoint |
| `client/src/api.js` | Add `exportTransactions()` method |
| `client/package.json` | Add `xlsx` dependency (via `npm install`) |
| `client/src/pages/DashboardPage.jsx` | Add `exportToExcel()` function and Export button |

---

### Task 1: API — `GET /api/transactions/export`

**Files:**
- Modify: `server/routes/transactions.js`
- Test: `server/tests/transactions.test.js`

> **Critical:** The new route `router.get('/export', ...)` must be placed **before** `router.get('/:assetId', ...)`. Express matches routes in registration order — if `/:assetId` comes first, the string `"export"` is treated as an asset ID and the route is never reached.
>
> **Auth is already covered:** `server/app.js` line 25 applies `verifyJwt` to all `/api/*` routes before mounting any router. `GET /api/transactions/export` is automatically auth-protected — no inline middleware needed in the handler.
>
> The `assets` table has no `user_id` column — all assets/transactions are returned (correct for a single-user personal portfolio app).

- [ ] **Step 1: Write the failing tests**

Open `server/tests/transactions.test.js`. Add a new `describe` block after all existing ones:

```js
describe('GET /api/transactions/export', () => {
  let exportTxId;

  beforeAll(() => {
    // Insert a known transaction to assert computed fields
    const r = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)'
    ).run(assetId, 'buy', 3, 200, '2024-06-01');
    exportTxId = r.lastInsertRowid;
  });

  it('returns 200 with an array when authenticated', async () => {
    const res = await request(app).get('/api/transactions/export').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('includes asset_name and symbol in each row', async () => {
    const res = await request(app).get('/api/transactions/export').set('Cookie', cookie);
    const row = res.body.find(r => r.id === exportTxId);
    expect(row.asset_name).toBe('Apple');
    expect(row.symbol).toBe('AAPL');
  });

  it('computes total_usd as quantity * price_usd', async () => {
    const res = await request(app).get('/api/transactions/export').set('Cookie', cookie);
    const row = res.body.find(r => r.id === exportTxId);
    expect(row.total_usd).toBeCloseTo(3 * 200);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/api/transactions/export');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test -- --reporter=verbose transactions
```

Expected: the 4 new tests FAIL, all existing tests PASS.

- [ ] **Step 3: Add the export route to transactions.js**

Open `server/routes/transactions.js`. Insert the new handler **before** the existing `router.get('/:assetId', ...)` line. The file should look like:

```js
const express = require('express');

function createTransactionsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, action, quantity, price_usd, date, remarks } = req.body;
    if (!asset_id || !action || !quantity || !price_usd || !date) {
      return res.status(400).json({ error: 'asset_id, action, quantity, price_usd, date are required' });
    }
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'action must be buy or sell' });
    }
    if (quantity <= 0 || price_usd <= 0 || isNaN(quantity) || isNaN(price_usd)) {
      return res.status(400).json({ error: 'quantity and price_usd must be positive numbers' });
    }
    if (remarks !== undefined && remarks !== null && remarks !== '') {
      if (typeof remarks !== 'string' || remarks.length > 500) {
        return res.status(400).json({ error: 'remarks must be a string of 500 characters or fewer' });
      }
    }

    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const result = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, date, remarks) VALUES (?,?,?,?,?,?)'
    ).run(asset_id, action, quantity, price_usd, date, remarks || null);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  // IMPORTANT: /export must be registered BEFORE /:assetId
  router.get('/export', (req, res) => {
    const rows = db.prepare(`
      SELECT t.id, t.date, t.action, t.quantity, t.price_usd,
             (t.quantity * t.price_usd) AS total_usd,
             t.remarks,
             a.name AS asset_name, a.symbol, a.type
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      ORDER BY t.date DESC, t.created_at DESC
    `).all();
    res.json(rows);
  });

  router.get('/:assetId', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const txs = db.prepare(
      'SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.params.assetId);
    res.json(txs);
  });

  return router;
}

module.exports = { createTransactionsRouter };
```

- [ ] **Step 4: Run all transaction tests**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test -- --reporter=verbose transactions
```

Expected: all 11 tests PASS (7 existing + 4 new).

- [ ] **Step 5: Run the full test suite**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test
```

Expected: all tests PASS with no failures.

- [ ] **Step 6: Commit**

```bash
cd F:\PROJECTS\profolio_viewer
git add server/routes/transactions.js server/tests/transactions.test.js
git commit -m "feat: add GET /api/transactions/export endpoint"
```

---

### Task 2: Client — install xlsx, API method, dashboard button

**Files:**
- Modify: `client/src/api.js`
- Modify: `client/src/pages/DashboardPage.jsx`
- Side effect: `client/package.json` and root `package-lock.json` updated by npm install

> No automated tests for the UI — verify manually. `apiFetch` handles 401 by redirecting to `/login` and returning `undefined` (it does NOT throw). The `exportToExcel` function must check for `undefined` before proceeding.

- [ ] **Step 1: Install xlsx in the client workspace**

```bash
cd F:\PROJECTS\profolio_viewer && npm install xlsx --workspace=client
```

Expected: `xlsx` appears in `client/package.json` dependencies, `package-lock.json` updated.

- [ ] **Step 2: Add `exportTransactions` to api.js**

Open `client/src/api.js`. Add one line inside the `api` object, after `getTransactions`:

```js
  exportTransactions: () =>
    apiFetch('/api/transactions/export'),
```

The full `api` object should now end with:

```js
  getTransactions: (assetId) =>
    apiFetch(`/api/transactions/${assetId}`),

  exportTransactions: () =>
    apiFetch('/api/transactions/export'),

  addValuation: (data) =>
    apiFetch('/api/flat-valuations', { method: 'POST', body: data }),

  getPrice: (symbol, type) =>
    apiFetch(`/api/prices/${symbol}?type=${type}`),
```

- [ ] **Step 3: Add `exportToExcel` function to DashboardPage.jsx**

Open `client/src/pages/DashboardPage.jsx`. Add the `xlsx` import at the top of the file (after the existing imports):

```js
import * as XLSX from 'xlsx';
```

Then add the `exportToExcel` function inside `DashboardPage`, after `handleLogout`:

```js
async function exportToExcel() {
  const data = await api.exportTransactions();
  if (!data) return; // 401 — apiFetch already redirected to /login

  const rows = data.map(t => ({
    'Asset Name': t.asset_name,
    'Symbol': t.symbol,
    'Type': t.type,
    'Date': t.date,
    'Action': t.action,
    'Quantity': t.quantity,
    'Price (USD)': t.price_usd,
    'Total (USD)': t.total_usd,
    'Remarks': t.remarks ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
```

- [ ] **Step 4: Add the Export button to the dashboard header**

In the header `<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>`, add the Export button after the Refresh button and before the + Add Asset button:

```jsx
<button onClick={loadPortfolio} style={styles.btn}>Refresh</button>
<button onClick={exportToExcel} style={styles.btn}>Export to Excel</button>
<button onClick={() => setShowAddAsset(true)} style={styles.btnPrimary}>+ Add Asset</button>
```

- [ ] **Step 5: Start the dev server and verify manually**

In one terminal:
```bash
cd F:\PROJECTS\profolio_viewer\server && npm run dev
```
In another terminal:
```bash
cd F:\PROJECTS\profolio_viewer\client && npm run dev
```

Open `http://localhost:5173`. Verify:
1. "Export to Excel" button appears in the dashboard header
2. Clicking it downloads a file named `transactions-YYYY-MM-DD.xlsx`
3. Open the file in Excel — confirm columns: Asset Name, Symbol, Type, Date, Action, Quantity, Price (USD), Total (USD), Remarks
4. If there are no transactions, the file downloads with headers only (empty sheet)

- [ ] **Step 6: Commit**

```bash
cd F:\PROJECTS\profolio_viewer
git add client/src/api.js client/src/pages/DashboardPage.jsx client/package.json package-lock.json
git commit -m "feat: add Export to Excel button to dashboard"
```
