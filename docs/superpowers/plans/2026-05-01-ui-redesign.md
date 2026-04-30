# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline hardcoded colors with CSS custom properties, implement dark purple / glassmorphism dark mode and clean neutral light mode, and add a persistent toggle button.

**Architecture:** A new `theme.css` defines all color tokens as CSS variables on `:root` (dark by default); `[data-theme="light"]` on `<html>` activates light mode. A `useTheme` hook manages the toggle and persists to `localStorage`. All components drop hardcoded color strings and reference `var(--*)` instead. No backend changes. No new npm packages.

**Tech Stack:** React 18, Vite 5, CSS custom properties, `localStorage`

---

## File Structure

**New files:**
- `client/src/theme.css` — all CSS variable tokens + `body` base styles
- `client/src/useTheme.js` — React hook: reads/writes `localStorage.theme`, toggles `data-theme` attribute on `<html>`

**Modified files:**
- `client/src/main.jsx` — import `theme.css`; synchronous theme init before React renders
- `client/src/components/SummaryBar.jsx` — two-card layout with theme tokens
- `client/src/components/AssetTable.jsx` — stacked name/symbol, pill type badge, row hover via `onMouseEnter`/`onMouseLeave`, `PnlCell` theme tokens
- `client/src/pages/DashboardPage.jsx` — `useTheme` hook, ☀️/🌙 toggle button in header, theme tokens
- `client/src/pages/LoginPage.jsx` — theme tokens
- `client/src/components/AddAssetModal.jsx` — theme tokens (card, inputs, buttons)
- `client/src/components/AddValuationModal.jsx` — theme tokens (card, inputs, buttons)
- `client/src/pages/TransactionHistoryPage.jsx` — theme tokens throughout

**Note on testing:** This plan makes no logic changes — only color values change. There are no frontend unit tests in this project (vitest is server-only). Each task verifies correctness by running `npm run build --workspace=client` (catches syntax/import errors) and a manual visual check in the browser via `npm run dev`. Server tests remain untouched and must still pass.

---

### Task 1: CSS theme foundation

Create the CSS variable system and `useTheme` hook. Everything else depends on these.

**Files:**
- Create: `client/src/theme.css`
- Create: `client/src/useTheme.js`
- Modify: `client/src/main.jsx`

- [ ] **Step 1: Create `client/src/theme.css`**

```css
body {
  margin: 0;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: system-ui, -apple-system, sans-serif;
}

:root {
  --bg-base: #13111c;
  --bg-card: linear-gradient(135deg, #1e1a2e, #2a2040);
  --bg-table-header: #1e1a2e;
  --border: #3b3060;
  --text-primary: #e2e8f0;
  --text-secondary: #7c6fad;
  --text-muted: #c4b5fd;
  --accent: #a78bfa;
  --badge-bg: #2e1a5e;
  --pnl-up: #4ade80;
  --pnl-down: #f87171;
  --btn-primary-bg: #7c3aed;
  --btn-primary-text: #ffffff;
  --btn-secondary-bg: transparent;
  --btn-secondary-border: #3b3060;
  --btn-secondary-text: #c4b5fd;
  --input-bg: #1e1a2e;
  --input-border: #3b3060;
  --input-text: #e2e8f0;
  --shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  --row-hover: rgba(167, 139, 250, 0.06);
}

[data-theme="light"] {
  --bg-base: #f8fafc;
  --bg-card: #ffffff;
  --bg-table-header: #f1f5f9;
  --border: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #475569;
  --accent: #334155;
  --badge-bg: #f1f5f9;
  --pnl-up: #10b981;
  --pnl-down: #ef4444;
  --btn-primary-bg: #2563eb;
  --btn-primary-text: #ffffff;
  --btn-secondary-bg: #ffffff;
  --btn-secondary-border: #e2e8f0;
  --btn-secondary-text: #475569;
  --input-bg: #ffffff;
  --input-border: #e2e8f0;
  --input-text: #0f172a;
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  --row-hover: rgba(0, 0, 0, 0.03);
}
```

- [ ] **Step 2: Create `client/src/useTheme.js`**

Dark mode = **no** `data-theme` attribute (`:root` is dark by default). Light mode = `data-theme="light"` on `<html>`. Never set `data-theme="dark"`.

```js
import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  return [theme, toggleTheme];
}
```

- [ ] **Step 3: Update `client/src/main.jsx`**

Import `theme.css` and run a synchronous theme init **before** React renders to prevent a flash of the wrong theme on page load.

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './theme.css';
import App from './App';

// Sync init — apply saved theme before first paint to avoid flash
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Verify build passes**

```bash
cd F:/PROJECTS/profolio_viewer
npm run build --workspace=client
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/theme.css client/src/useTheme.js client/src/main.jsx
git commit -m "feat: add CSS theme system and useTheme hook"
```

---

### Task 2: SummaryBar redesign

Replace the single dark bar with two side-by-side cards using theme tokens.

**Files:**
- Modify: `client/src/components/SummaryBar.jsx`

- [ ] **Step 1: Replace `client/src/components/SummaryBar.jsx`**

Full replacement — two cards side by side, all colors via CSS variables:

```jsx
export default function SummaryBar({ totalValue, totalPnlUsd, totalPnlPct }) {
  const pnlPositive = (totalPnlUsd ?? 0) >= 0;

  return (
    <div style={styles.bar}>
      <div style={styles.card}>
        <span style={styles.label}>Total Portfolio Value</span>
        <span style={styles.value}>
          ${(totalValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
      <div style={styles.card}>
        <span style={styles.label}>Total P&L</span>
        <span style={{ ...styles.value, color: pnlPositive ? 'var(--pnl-up)' : 'var(--pnl-down)' }}>
          {pnlPositive ? '+' : ''}${(totalPnlUsd ?? 0).toFixed(2)}
          {totalPnlPct != null && (
            <span style={{ fontSize: '0.9rem', marginLeft: '6px', opacity: 0.85 }}>
              ({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct}%)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

const styles = {
  bar: { display: 'flex', gap: '1rem', marginBottom: '1.5rem' },
  card: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '1rem 1.5rem',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow)',
  },
  label: {
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build --workspace=client
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SummaryBar.jsx
git commit -m "feat: redesign SummaryBar with themed two-card layout"
```

---

### Task 3: AssetTable redesign

Add stacked name/symbol in asset column, pill type badge, row hover via mouse events, and replace `PnlCell` hardcoded colors.

**Files:**
- Modify: `client/src/components/AssetTable.jsx`

- [ ] **Step 1: Replace `client/src/components/AssetTable.jsx`**

Key changes from original:
- Import `useState` for `hoveredRow`
- `PnlCell`: replace `'#16a34a'` → `'var(--pnl-up)'`, `'#dc2626'` → `'var(--pnl-down)'`
- Name `<td>`: stack `asset.name` (bold, `--text-primary`) above `asset.symbol` (small, `--text-secondary`)
- Type `<td>`: render as pill badge with `--badge-bg` / `--text-muted`
- `<tr>`: add `onMouseEnter`/`onMouseLeave` toggling `background: var(--row-hover)`
- All `styles.*` colors → CSS variables

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function PnlCell({ value, pct }) {
  if (value == null) return <td style={styles.td}>—</td>;
  const color = value >= 0 ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <td style={{ ...styles.td, color, fontWeight: '600' }}>
      {value >= 0 ? '+' : ''}${value.toFixed(2)}
      {pct != null && (
        <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.85 }}>
          ({pct >= 0 ? '+' : ''}{pct}%)
        </span>
      )}
    </td>
  );
}

export default function AssetTable({ assets, onDelete, onAddValuation }) {
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState(null);

  if (!assets.length) {
    return <p style={{ color: 'var(--text-secondary)' }}>No assets yet. Click "Add Asset" to get started.</p>;
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
              style={{ ...styles.row, background: hoveredRow === asset.id ? 'var(--row-hover)' : 'transparent' }}
              onClick={() => navigate(`/assets/${asset.id}`)}
              onMouseEnter={() => setHoveredRow(asset.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td style={styles.td}>
                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{asset.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{asset.symbol}</div>
              </td>
              <td style={styles.td}>
                <span style={styles.badge}>{asset.type}</span>
              </td>
              <td style={styles.td}>
                <strong style={{ color: 'var(--text-muted)' }}>{asset.symbol}</strong>
              </td>
              <td style={styles.td}>{asset.net_quantity != null ? asset.net_quantity : '—'}</td>
              <td style={styles.td}>{asset.avg_buy_price != null ? `$${asset.avg_buy_price.toFixed(2)}` : '—'}</td>
              <td style={styles.td}>
                {asset.current_price != null
                  ? (
                    <span>
                      ${asset.current_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      {asset.price_stale && (
                        <span title="Price may be outdated" style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>
                      )}
                    </span>
                  )
                  : <span style={{ color: 'var(--text-secondary)' }} title="Symbol not found or fetch failed">—</span>
                }
              </td>
              <td style={styles.td}>{asset.current_value != null ? `$${asset.current_value.toLocaleString()}` : '—'}</td>
              <PnlCell value={asset.pnl_usd} pct={asset.pnl_pct} />
              <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {asset.price_updated_at ? new Date(asset.price_updated_at).toLocaleTimeString() : '—'}
              </td>
              <td style={styles.td} onClick={e => e.stopPropagation()}>
                {(asset.type === 'flat' || asset.type === 'other') && (
                  <button style={styles.actionBtn} onClick={() => onAddValuation(asset)}>+ Val</button>
                )}
                <button
                  style={{ ...styles.actionBtn, color: 'var(--pnl-down)', borderColor: 'var(--pnl-down)' }}
                  onClick={() => onDelete(asset.id)}
                >
                  Del
                </button>
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
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    background: 'var(--bg-table-header)',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  row: { cursor: 'pointer', transition: 'background 0.15s' },
  badge: {
    background: 'var(--badge-bg)',
    color: 'var(--text-muted)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    marginRight: '4px',
    padding: '2px 8px',
    border: '1px solid var(--btn-secondary-border)',
    borderRadius: '4px',
    cursor: 'pointer',
    background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)',
    fontSize: '0.75rem',
  },
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build --workspace=client
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/AssetTable.jsx
git commit -m "feat: redesign AssetTable with stacked names, type badges, row hover"
```

---

### Task 4: DashboardPage theme toggle

Wire up `useTheme`, add the ☀️/🌙 toggle button to the header, and replace all hardcoded colors.

**Files:**
- Modify: `client/src/pages/DashboardPage.jsx`

- [ ] **Step 1: Replace `client/src/pages/DashboardPage.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTheme } from '../useTheme';
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
  const [theme, toggleTheme] = useTheme();

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
    try {
      await api.deleteAsset(assetId);
      loadPortfolio();
    } catch {
      setError('Failed to delete asset');
    }
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={loadPortfolio} style={styles.btn}>Refresh</button>
          <button onClick={() => setShowAddAsset(true)} style={styles.btnPrimary}>+ Add Asset</button>
          <button onClick={toggleTheme} style={styles.btn} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} style={{ ...styles.btn, color: 'var(--pnl-down)' }}>Logout</button>
        </div>
      </header>

      {error && <p style={{ color: 'var(--pnl-down)', marginTop: 0 }}>{error}</p>}

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
  heading: { margin: 0, fontSize: '1.75rem', color: 'var(--accent)', letterSpacing: '0.05em' },
  btn: {
    padding: '8px 16px',
    border: '1px solid var(--btn-secondary-border)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)',
  },
  btnPrimary: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    fontWeight: '600',
  },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build --workspace=client
```

Expected: build succeeds.

- [ ] **Step 3: Start dev server and test toggle manually**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- Page renders in dark purple mode
- Clicking ☀️ switches to clean neutral light mode
- Clicking 🌙 switches back to dark
- Refreshing the page keeps the last selected theme
- Check browser DevTools → Application → Local Storage: `theme` key is set correctly

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/DashboardPage.jsx
git commit -m "feat: add dark/light mode toggle to dashboard"
```

---

### Task 5: LoginPage theming

Apply theme tokens to the login page.

**Files:**
- Modify: `client/src/pages/LoginPage.jsx`

- [ ] **Step 1: Replace `client/src/pages/LoginPage.jsx`**

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
            <label style={styles.label}>Username</label>
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
            <label style={styles.label}>Password</label>
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
  container: {
    display: 'flex',
    minHeight: '100vh',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
  },
  card: {
    background: 'var(--bg-card)',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
    width: '320px',
  },
  title: { margin: '0 0 1.5rem', fontSize: '1.5rem', textAlign: 'center', color: 'var(--accent)' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '0.875rem', color: 'var(--text-secondary)' },
  input: {
    padding: '8px',
    border: '1px solid var(--input-border)',
    borderRadius: '6px',
    fontSize: '1rem',
    background: 'var(--input-bg)',
    color: 'var(--input-text)',
  },
  button: {
    padding: '10px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: '600',
  },
  error: { color: 'var(--pnl-down)', margin: 0, fontSize: '0.875rem' },
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build --workspace=client
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LoginPage.jsx
git commit -m "feat: apply theme tokens to login page"
```

---

### Task 6: Modal theming

Apply theme tokens to both modal components.

**Files:**
- Modify: `client/src/components/AddAssetModal.jsx`
- Modify: `client/src/components/AddValuationModal.jsx`

- [ ] **Step 1: Replace `client/src/components/AddAssetModal.jsx`**

Only the `styles` constants at the bottom change. The JSX logic is unchanged. Replace the entire file:

```jsx
import { useState } from 'react';
import { api } from '../api';

const ASSET_TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function AddAssetModal({ onClose, onSuccess }) {
  const [type, setType] = useState('stock');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [action, setAction] = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Add Asset</h2>
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

          {error && <p style={{ color: 'var(--pnl-down)', margin: 0 }}>{error}</p>}

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
      <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modal = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  padding: '1.5rem',
  borderRadius: '10px',
  width: '400px',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: 'var(--shadow)',
};
const form = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const input = {
  padding: '8px',
  border: '1px solid var(--input-border)',
  borderRadius: '6px',
  fontSize: '1rem',
  background: 'var(--input-bg)',
  color: 'var(--input-text)',
};
const submitBtn = {
  padding: '8px 20px',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
};
const cancelBtn = {
  padding: '8px 20px',
  background: 'var(--btn-secondary-bg)',
  border: '1px solid var(--btn-secondary-border)',
  color: 'var(--btn-secondary-text)',
  borderRadius: '6px',
  cursor: 'pointer',
};
```

- [ ] **Step 2: Replace `client/src/components/AddValuationModal.jsx`**

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
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Add Valuation — {asset.name}</h2>
        <form onSubmit={handleSubmit} style={form}>
          <div style={field}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Current Value (USD)</label>
            <input type="number" step="any" value={valueUsd} onChange={e => setValueUsd(e.target.value)} required style={inp} />
          </div>
          <div style={field}>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={inp} />
          </div>
          {error && <p style={{ color: 'var(--pnl-down)', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modal = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  padding: '1.5rem',
  borderRadius: '10px',
  width: '360px',
  boxShadow: 'var(--shadow)',
};
const form = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const field = { display: 'flex', flexDirection: 'column', gap: '4px' };
const inp = {
  padding: '8px',
  border: '1px solid var(--input-border)',
  borderRadius: '6px',
  fontSize: '1rem',
  background: 'var(--input-bg)',
  color: 'var(--input-text)',
};
const submitBtn = {
  padding: '8px 20px',
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
};
const cancelBtn = {
  padding: '8px 20px',
  background: 'var(--btn-secondary-bg)',
  border: '1px solid var(--btn-secondary-border)',
  color: 'var(--btn-secondary-text)',
  borderRadius: '6px',
  cursor: 'pointer',
};
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build --workspace=client
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/AddAssetModal.jsx client/src/components/AddValuationModal.jsx
git commit -m "feat: apply theme tokens to Add Asset and Add Valuation modals"
```

---

### Task 7: TransactionHistoryPage theming

Apply theme tokens throughout the transaction history page.

**Files:**
- Modify: `client/src/pages/TransactionHistoryPage.jsx`

- [ ] **Step 1: Replace `client/src/pages/TransactionHistoryPage.jsx`**

Key changes:
- `page` wrapper: no explicit background (inherits `body` background from `theme.css`)
- `backBtn`: `--btn-secondary-*` tokens
- `addBtn`: `--btn-primary-*` tokens
- `txForm` panel: `background: var(--bg-table-header)`, `border: 1px solid var(--border)`
- `inp` (inputs/selects in form): `--input-*` tokens
- `submitBtn` (Save button): `--btn-primary-*` tokens
- Table `th`: `--bg-table-header`, `--border`, `--text-secondary`
- Table `td`: `--border`, `--text-primary`
- Buy/sell action color: `var(--pnl-up)` / `var(--pnl-down)`
- Error text: `var(--pnl-down)`
- "No transactions" text: `var(--text-secondary)`

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
      await api.addTransaction({
        asset_id: parseInt(assetId),
        ...form,
        quantity: parseFloat(form.quantity),
        price_usd: parseFloat(form.price_usd),
      });
      setShowAddTx(false);
      load();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <div style={styles.center}>Loading…</div>;

  return (
    <div style={styles.page}>
      <button onClick={() => navigate('/')} style={styles.backBtn}>← Back to Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Transaction History</h2>
        <button onClick={() => setShowAddTx(!showAddTx)} style={styles.addBtn}>+ Add Transaction</button>
      </div>

      {showAddTx && (
        <form onSubmit={handleAddTx} style={styles.txForm}>
          <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} style={styles.inp}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <input placeholder="Quantity" type="number" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required style={styles.inp} />
          <input placeholder="Price (USD)" type="number" step="any" value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))} required style={styles.inp} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={styles.inp} />
          {error && <span style={{ color: 'var(--pnl-down)' }}>{error}</span>}
          <button type="submit" style={styles.submitBtn}>Save</button>
        </form>
      )}

      {transactions.length === 0
        ? <p style={{ color: 'var(--text-secondary)' }}>No transactions yet.</p>
        : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Date', 'Action', 'Quantity', 'Price (USD)', 'Total (USD)'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={styles.td}>{tx.date}</td>
                  <td style={{
                    ...styles.td,
                    color: tx.action === 'buy' ? 'var(--pnl-up)' : 'var(--pnl-down)',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                  }}>{tx.action}</td>
                  <td style={styles.td}>{tx.quantity}</td>
                  <td style={styles.td}>${tx.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={styles.td}>${(tx.quantity * tx.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '800px', margin: '0 auto', padding: '1.5rem' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  backBtn: {
    marginBottom: '1rem',
    padding: '6px 12px',
    border: '1px solid var(--btn-secondary-border)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)',
  },
  addBtn: {
    padding: '8px 16px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  txForm: {
    display: 'flex',
    gap: '8px',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    padding: '1rem',
    background: 'var(--bg-table-header)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
  },
  inp: {
    padding: '8px',
    border: '1px solid var(--input-border)',
    borderRadius: '4px',
    background: 'var(--input-bg)',
    color: 'var(--input-text)',
  },
  submitBtn: {
    padding: '8px 16px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    background: 'var(--bg-table-header)',
    borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
};
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build --workspace=client
```

Expected: build succeeds.

- [ ] **Step 3: Run server tests to confirm no regressions**

```bash
npm test --workspace=server
```

Expected: 41 tests pass.

- [ ] **Step 4: Full visual check**

Start dev server:
```bash
npm run dev
```

Open `http://localhost:5173` and verify:
- Login page: dark purple background, gradient card, themed inputs and button
- Dashboard: dark background, summary cards with gradient, purple-accented table, toggle button works
- Toggle to light mode: clean white/gray, all pages switch correctly (including login if you logout and back in)
- Transaction history page: themed table, add-transaction form panel matches theme
- Add Asset modal: dark gradient panel with themed inputs
- `localStorage` persists theme across page reloads

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/TransactionHistoryPage.jsx
git commit -m "feat: apply theme tokens to transaction history page"
```

- [ ] **Step 6: Push to GitHub**

```bash
git push
```

Railway will auto-deploy. Verify on the production URL after deploy completes.
