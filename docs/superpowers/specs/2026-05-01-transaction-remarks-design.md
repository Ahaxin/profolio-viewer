# Transaction Remarks Field Design

**Date:** 2026-05-01
**Status:** Ready for Implementation

## Overview

Add an optional free-text `remarks` field to buy/sell transactions. The field is stored in the database, submitted via the existing transaction form, and displayed as a native browser tooltip on hover in the transaction history table.

## Database

A new additive migration adds `remarks TEXT` (nullable) to the `transactions` table:

```sql
ALTER TABLE transactions ADD COLUMN remarks TEXT;
```

This runs after the existing `CREATE TABLE IF NOT EXISTS` block in `server/db/migrations.js`. The migration must be guarded with a `PRAGMA table_info` check so it is idempotent (safe to run on every startup).

**Guard pattern for SQLite:**
```js
const cols = db.prepare("PRAGMA table_info(transactions)").all();
if (!cols.some(c => c.name === 'remarks')) {
  db.exec("ALTER TABLE transactions ADD COLUMN remarks TEXT");
}
```

**Important:** The guard runs on **every app startup**, against both existing and freshly-created databases. On a brand-new DB, `CREATE TABLE IF NOT EXISTS` creates the table without the `remarks` column, then the guard immediately fires and adds it. On an already-upgraded DB, the guard finds the column and skips the `ALTER`. This dual-path behavior ensures the column is always present in all environments — production, development, and the in-memory test DB created by `beforeAll` in the test suite.

## API

### `POST /api/transactions`

- Accepts an optional `remarks` field in the request body (string, max 500 chars)
- Not required — omitting it or sending `null`/`''` is valid
- `remarks` must be extracted by name from `req.body` alongside the existing destructured fields
- Validation: if provided, must be a string ≤ 500 characters
- The INSERT statement must be updated to explicitly include `remarks`:

```sql
INSERT INTO transactions (asset_id, action, quantity, price_usd, date, remarks)
VALUES (?, ?, ?, ?, ?, ?)
```

The `.run(...)` call passes `remarks || null` as the sixth argument. Omitting it from the argument list would cause a runtime binding mismatch error.

### `GET /api/transactions/:assetId`

- No change needed — already uses `SELECT *`, so `remarks` is returned automatically once the column exists

## UI — `TransactionHistoryPage.jsx`

### Form

- Add `remarks: ''` to the initial form state
- Add a single-line `<input>` at the end of the form:
  - `placeholder="Remarks / reason (optional)"`
  - `maxLength={500}`
  - Uses existing `styles.inp` styling
- Pass `remarks: form.remarks` in the `api.addTransaction(...)` call

### Table

- Add `title={tx.remarks || undefined}` to each `<tr>` element
- When a transaction has remarks, the browser shows a native tooltip on hover
- Rows without remarks (`null` or empty string) show nothing — `undefined` suppresses the `title` attribute entirely

## Files Changed

| File | Action |
|------|--------|
| `server/db/migrations.js` | Add guarded `ALTER TABLE` for `remarks` column |
| `server/routes/transactions.js` | Accept `remarks` in POST body, include in INSERT |
| `client/src/pages/TransactionHistoryPage.jsx` | Add remarks input to form, add `title` to table rows |
| `server/tests/transactions.test.js` | Add test: POST with `remarks` stores and is returned by GET |

## Out of Scope

- Editing remarks on existing transactions
- Searching or filtering by remarks
- Showing remarks as a visible table column
