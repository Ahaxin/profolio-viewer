# Excel Export Design

**Date:** 2026-05-01
**Status:** Ready for Implementation

## Overview

Add an "Export to Excel" button on the dashboard that downloads all transactions across all assets as a `.xlsx` file. Data is fetched from a new auth-protected API endpoint and the file is generated client-side using SheetJS (`xlsx` package).

## Architecture

```
Dashboard button → GET /api/transactions/export (JSON)
                 → SheetJS builds .xlsx in browser
                 → Browser triggers file download
```

## API

### `GET /api/transactions/export`

- Auth-protected (behind `verifyJwt` middleware — already applied to all `/api` routes in `app.js`)
- Returns a JSON array of all transactions joined with their asset information
- Ordered by date descending

**SQL:**
```sql
SELECT t.id, t.date, t.action, t.quantity, t.price_usd,
       (t.quantity * t.price_usd) AS total_usd,
       t.remarks,
       a.name AS asset_name, a.symbol, a.type
FROM transactions t
JOIN assets a ON t.asset_id = a.id
ORDER BY t.date DESC, t.created_at DESC
```

**Response shape (array of objects):**
```json
[
  {
    "id": 1,
    "date": "2024-01-01",
    "action": "buy",
    "quantity": 5,
    "price_usd": 150,
    "total_usd": 750,
    "remarks": "initial position",
    "asset_name": "Apple",
    "symbol": "AAPL",
    "type": "stock"
  }
]
```

**Empty portfolio:** Returns `[]` — the client handles this gracefully (downloads an empty sheet).

**Added to:** `server/routes/transactions.js` as a new `router.get('/export', ...)` handler. Must be registered **before** `router.get('/:assetId', ...)` to avoid Express matching `export` as an `assetId`.

## Client

### New dependency

```
xlsx
```

Installed in the `client` workspace: `npm install xlsx --workspace=client`

### `client/src/api.js`

Add one method:

```js
exportTransactions: () =>
  apiFetch('/api/transactions/export'),
```

### `client/src/pages/DashboardPage.jsx`

Add an `exportToExcel()` async function:

1. Call `api.exportTransactions()` to fetch the JSON data
2. Map each row to a plain object with human-readable column names:
   - `Asset Name`, `Symbol`, `Type`, `Date`, `Action`, `Quantity`, `Price (USD)`, `Total (USD)`, `Remarks`
3. Use SheetJS to build a workbook:
   ```js
   import * as XLSX from 'xlsx';
   const ws = XLSX.utils.json_to_sheet(rows);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
   XLSX.writeFile(wb, `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
   ```
4. If the fetch throws (e.g. 401), navigate to `/login` — same pattern as other pages

Add an **Export to Excel** button in the dashboard header area, styled with `styles.secondaryBtn` (same style as other secondary actions on the page). Placed alongside existing header controls.

## Files Changed

| File | Action |
|------|--------|
| `server/routes/transactions.js` | Add `GET /export` handler before `GET /:assetId` |
| `client/src/api.js` | Add `exportTransactions()` method |
| `client/src/pages/DashboardPage.jsx` | Add `exportToExcel()` function and Export button |
| `client/package.json` | Add `xlsx` dependency |
| `server/tests/transactions.test.js` | Add test for `GET /api/transactions/export` |

## Out of Scope

- Per-asset export (single asset only)
- Date range filtering
- Column formatting / cell styling in the Excel file
- CSV alternative
