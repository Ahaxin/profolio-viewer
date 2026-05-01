# Transaction Remarks Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `remarks` text field to buy/sell transactions — stored in the database, submitted via the transaction form, and shown as a native hover tooltip in the transaction history table.

**Architecture:** Additive SQLite migration adds a nullable `remarks TEXT` column, guarded by `PRAGMA table_info` so it's idempotent on every startup. The POST route accepts and validates the field; the GET route returns it automatically via `SELECT *`. The UI adds a form input and a `title` attribute on each table row.

**Tech Stack:** Node.js/Express, better-sqlite3, React (inline styles, no extra libraries)

---

## File Map

| File | Action |
|------|--------|
| `server/db/migrations.js` | Add guarded `ALTER TABLE transactions ADD COLUMN remarks TEXT` |
| `server/routes/transactions.js` | Destructure `remarks` from body, validate, add to INSERT |
| `client/src/pages/TransactionHistoryPage.jsx` | Add `remarks` to form state + input field + `title` on `<tr>` |
| `server/tests/migrations.test.js` | Add test: `remarks` column exists after migration |
| `server/tests/transactions.test.js` | Add tests: remarks round-trip, validation, omission still works |

---

### Task 1: Migration — add `remarks` column

**Files:**
- Modify: `server/db/migrations.js`
- Test: `server/tests/migrations.test.js`

> The migration guard runs on every startup. On a fresh DB, `CREATE TABLE IF NOT EXISTS` creates the table without `remarks`, then the guard fires immediately and adds it. On an already-upgraded DB, `PRAGMA table_info` finds the column and skips the `ALTER`. Both paths are tested below.

- [ ] **Step 1: Write the failing migration test**

Open `server/tests/migrations.test.js` and add this test inside the `describe('migrations', ...)` block:

```js
it('transactions table has remarks column', () => {
  runMigrations(db);
  const cols = db.prepare("PRAGMA table_info(transactions)").all();
  expect(cols.some(c => c.name === 'remarks')).toBe(true);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test -- --reporter=verbose migrations
```

Expected: FAIL — `expect(false).toBe(true)` (column does not exist yet).

- [ ] **Step 3: Add the migration to migrations.js**

Open `server/db/migrations.js`. After the closing `);` of the `db.exec(...)` block (line 43), add:

```js
  // Additive migration: remarks column on transactions
  const txCols = db.prepare("PRAGMA table_info(transactions)").all();
  if (!txCols.some(c => c.name === 'remarks')) {
    db.exec("ALTER TABLE transactions ADD COLUMN remarks TEXT");
  }
```

The full file should now look like:

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
      date DATE NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Additive migration: remarks column on transactions
  const txCols = db.prepare("PRAGMA table_info(transactions)").all();
  if (!txCols.some(c => c.name === 'remarks')) {
    db.exec("ALTER TABLE transactions ADD COLUMN remarks TEXT");
  }
}

module.exports = { runMigrations };
```

- [ ] **Step 4: Run all migration tests**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test -- --reporter=verbose migrations
```

Expected: all 8 tests PASS including the new `remarks column` test and the existing idempotency test (`running twice does not throw`).

- [ ] **Step 5: Commit**

```bash
cd F:\PROJECTS\profolio_viewer
git add server/db/migrations.js server/tests/migrations.test.js
git commit -m "feat: add remarks column to transactions table"
```

---

### Task 2: API — accept and store `remarks`

**Files:**
- Modify: `server/routes/transactions.js`
- Test: `server/tests/transactions.test.js`

> The POST route must explicitly include `remarks` in the INSERT — SQLite will not pick it up automatically. Passing `remarks || null` as the sixth bind parameter stores `NULL` when the field is absent or empty.

- [ ] **Step 1: Write the failing API tests**

Open `server/tests/transactions.test.js` and add these three tests inside the `describe('POST /api/transactions', ...)` block:

```js
it('stores and returns remarks when provided', async () => {
  const res = await request(app).post('/api/transactions').set('Cookie', cookie)
    .send({ asset_id: assetId, action: 'buy', quantity: 1, price_usd: 100, date: '2024-03-01', remarks: 'test entry reason' });
  expect(res.status).toBe(201);

  const getRes = await request(app).get(`/api/transactions/${assetId}`).set('Cookie', cookie);
  const tx = getRes.body.find(t => t.id === res.body.id);
  expect(tx.remarks).toBe('test entry reason');
});

it('accepts transaction without remarks', async () => {
  const res = await request(app).post('/api/transactions').set('Cookie', cookie)
    .send({ asset_id: assetId, action: 'sell', quantity: 1, price_usd: 110, date: '2024-03-02' });
  expect(res.status).toBe(201);

  const getRes = await request(app).get(`/api/transactions/${assetId}`).set('Cookie', cookie);
  const tx = getRes.body.find(t => t.id === res.body.id);
  expect(tx.remarks === null || tx.remarks === '').toBe(true);
});

it('rejects remarks longer than 500 characters', async () => {
  const res = await request(app).post('/api/transactions').set('Cookie', cookie)
    .send({ asset_id: assetId, action: 'buy', quantity: 1, price_usd: 100, date: '2024-03-03', remarks: 'x'.repeat(501) });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test -- --reporter=verbose transactions
```

Expected: the three new tests FAIL. Existing tests still PASS.

- [ ] **Step 3: Update the POST route in transactions.js**

Open `server/routes/transactions.js` and replace the entire `router.post('/', ...)` handler with:

```js
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
```

- [ ] **Step 4: Run all transaction tests**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test -- --reporter=verbose transactions
```

Expected: all tests PASS (existing 4 + new 3 = 7 total).

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm test
```

Expected: all 41+ tests PASS.

- [ ] **Step 6: Commit**

```bash
cd F:\PROJECTS\profolio_viewer
git add server/routes/transactions.js server/tests/transactions.test.js
git commit -m "feat: accept and store remarks on transactions"
```

---

### Task 3: UI — remarks input and hover tooltip

**Files:**
- Modify: `client/src/pages/TransactionHistoryPage.jsx`

> No automated tests for the UI — verify manually by running the dev server. The form input is optional (no `required` attribute). The `title` attribute is set to `undefined` when remarks is absent so React omits it from the DOM entirely.

- [ ] **Step 1: Add `remarks` to form state**

In `TransactionHistoryPage.jsx`, find the `useState` call on line 11:

```js
const [form, setForm] = useState({ action: 'buy', quantity: '', price_usd: '', date: new Date().toISOString().slice(0, 10) });
```

Replace with:

```js
const [form, setForm] = useState({ action: 'buy', quantity: '', price_usd: '', date: new Date().toISOString().slice(0, 10), remarks: '' });
```

- [ ] **Step 2: Add the remarks input to the form**

In the `<form>` block, after the date `<input>` (line 57) and before the error span, add:

```jsx
<input
  placeholder="Remarks / reason (optional)"
  type="text"
  maxLength={500}
  value={form.remarks}
  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
  style={styles.inp}
/>
```

- [ ] **Step 3: Add title tooltip to table rows**

In the `<tbody>`, find each `<tr key={tx.id}>` (line 76) and add the `title` prop:

```jsx
<tr key={tx.id} title={tx.remarks || undefined}>
```

- [ ] **Step 4: Verify the remarks field is sent with the API call**

The existing `handleAddTx` function spreads `...form` into `api.addTransaction(...)`. Since `remarks` is now part of form state, it will be included automatically. No change needed to `handleAddTx`.

- [ ] **Step 5: Reset form on submit and on close**

The toggle button (`onClick={() => setShowAddTx(!showAddTx)}`) does not reset form state, so previously typed values persist if the user reopens the form. Fix both paths — reset on successful submit and on close.

Replace the toggle button's onClick:

```jsx
<button onClick={() => {
  setShowAddTx(v => {
    if (v) setForm({ action: 'buy', quantity: '', price_usd: '', date: new Date().toISOString().slice(0, 10), remarks: '' });
    return !v;
  });
}} style={styles.addBtn}>+ Add Transaction</button>
```

Also update `handleAddTx` to reset after successful submit:

```js
async function handleAddTx(e) {
  e.preventDefault();
  setError('');
  try {
    await api.addTransaction({
      asset_id: parseInt(assetId),
      ...form,
      quantity: parseFloat(form.quantity),
      price_usd: parseFloat(form.price_usd),
    });
    setShowAddTx(false);
    setForm({ action: 'buy', quantity: '', price_usd: '', date: new Date().toISOString().slice(0, 10), remarks: '' });
    load();
  } catch (err) { setError(err.message); }
}
```

- [ ] **Step 6: Start the dev server and verify manually**

```bash
cd F:\PROJECTS\profolio_viewer\server && npm run dev
```
In another terminal:
```bash
cd F:\PROJECTS\profolio_viewer\client && npm run dev
```

Open `http://localhost:5173` in a browser. Navigate to a transaction history page.

Verify:
1. "+ Add Transaction" form shows a "Remarks / reason (optional)" text input
2. Submit a transaction with remarks — it saves without error
3. Hover the new row — the browser tooltip shows the remarks text
4. Submit a transaction without remarks — it saves without error
5. Hover the no-remarks row — no tooltip appears

- [ ] **Step 7: Commit**

```bash
cd F:\PROJECTS\profolio_viewer
git add client/src/pages/TransactionHistoryPage.jsx
git commit -m "feat: add remarks input to transaction form and hover tooltip"
```
