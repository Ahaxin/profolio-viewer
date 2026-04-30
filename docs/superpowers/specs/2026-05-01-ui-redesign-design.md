# UI Redesign — Design Spec
**Date:** 2026-05-01

## Overview

Redesign the portfolio viewer frontend with a dark purple / glassmorphism visual style, a clean neutral light mode, and a persistent dark/light mode toggle. No backend changes. No new npm packages.

---

## Visual Style

### Dark Mode (default)
Deep purple-black background with violet/lavender accents, gradient cards, and subtle border glow. Inspired by premium crypto trading apps.

| Element | Value |
|---|---|
| Page background | `#13111c` |
| Card background | `linear-gradient(135deg, #1e1a2e, #2a2040)` |
| Unified border (cards, inputs, buttons) | `#3b3060` |
| Table header background | `#1e1a2e` |
| Primary text | `#e2e8f0` |
| Secondary text / labels | `#7c6fad` |
| Accent (heading, logo) | `#a78bfa` |
| Muted data (price, symbol) | `#c4b5fd` |
| Type badge background | `#2e1a5e` |
| P&L up | `#4ade80` |
| P&L down | `#f87171` |
| Primary button background | `#7c3aed` |

### Light Mode
White cards on light gray, no purple. Clean, high-contrast, readable in daylight.

| Element | Value |
|---|---|
| Page background | `#f8fafc` |
| Card background | `#ffffff` |
| Unified border (cards, inputs, buttons) | `#e2e8f0` |
| Table header background | `#f1f5f9` |
| Primary text | `#0f172a` |
| Secondary text / labels | `#64748b` |
| Accent (heading, logo) | `#334155` |
| Muted data (price, symbol) | `#475569` |
| Type badge background | `#f1f5f9` |
| P&L up | `#10b981` |
| P&L down | `#ef4444` |
| Primary button background | `#2563eb` |

---

## Theming Architecture

### CSS variables (`client/src/theme.css`)

All color tokens are defined as CSS custom properties on `:root` (dark mode values by default). A `[data-theme="light"]` selector on `<html>` overrides them to light mode values.

`--border` is a **single unified border token** used for card borders, input borders, and button borders alike. There is no separate card-border token.

`--bg-card` is a CSS gradient in dark mode and a solid color in light mode. All components applying this token **must use the `background:` shorthand property** (not `background-color:`), since CSS gradients are not valid values for `background-color`.

`body` background must be set to `var(--bg-base)` in `theme.css` so the page background switches with the theme.

```css
body {
  margin: 0;
  background: var(--bg-base);
  color: var(--text-primary);
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

### Theme hook (`client/src/useTheme.js`)

- Reads `localStorage.theme` on mount; defaults to `'dark'` if not set
- **Dark mode = no `data-theme` attribute on `<html>`** (dark is the CSS `:root` default). **Light mode = `data-theme="light"` on `<html>`.** Never set `data-theme="dark"` — only set or remove `data-theme="light"`.
- Returns `[theme, toggleTheme]`
- `toggleTheme` flips between `'dark'` and `'light'` and persists to `localStorage`

### Initialization (`client/src/main.jsx`)

Import `theme.css` here (once, globally). Before React renders, read `localStorage.theme` synchronously and, **if the value is `'light'`**, set `document.documentElement.setAttribute('data-theme', 'light')`. Do nothing for dark (no attribute = dark). This prevents a flash of wrong theme on page load.

---

## Component Changes

All components replace hardcoded color strings in inline `style={}` objects with `var(--*)` references. Use `background:` (not `background-color:`) for any surface that uses `--bg-card` or `--bg-base`. No structural changes beyond what is listed below.

### `client/src/pages/DashboardPage.jsx`
- Use `useTheme` hook; add a toggle button in the header (☀️ in dark mode, 🌙 in light mode), placed to the left of Logout
- Page wrapper background: none needed — `body` background from `theme.css` covers it
- Replace all hardcoded colors with CSS variables

### `client/src/components/AssetTable.jsx`
- Asset column: stack name (`--text-primary`) above symbol (`--text-secondary`) in the same cell
- Type column: render as a pill badge — `background: var(--badge-bg)`, `color: var(--text-muted)`, `border-radius: 4px`, `padding: 2px 6px`, `font-size: 0.75rem`
- Row hover: implement via `onMouseEnter` / `onMouseLeave` state on each `<tr>`, toggling `background: var(--row-hover)`. **Do not use a CSS class** — the codebase uses inline styles throughout; stay consistent.
- `PnlCell` sub-component: replace hardcoded `'#16a34a'` with `var(--pnl-up)` and `'#dc2626'` with `var(--pnl-down)`
- Replace all other hardcoded colors with CSS variables

### `client/src/components/SummaryBar.jsx`
- Change from a single dark bar to two separate cards side by side
- Each card: `background: var(--bg-card)`, `border: 1px solid var(--border)`, `border-radius: 10px`, `box-shadow: var(--shadow)`, `padding: 1rem 1.5rem`
- Replace all hardcoded colors with CSS variables

### `client/src/pages/LoginPage.jsx`
- Page container background: `background: var(--bg-base)`
- Card: `background: var(--bg-card)`, `border: 1px solid var(--border)`, `box-shadow: var(--shadow)`
- Input: `background: var(--input-bg)`, `border: 1px solid var(--input-border)`, `color: var(--input-text)`
- Replace all other hardcoded colors with CSS variables

### `client/src/pages/TransactionHistoryPage.jsx`
- Page wrapper: `background: var(--bg-base)` (replaces any hardcoded page background)
- Transaction table: same token treatment as `AssetTable` (header, rows, borders)
- Buy/sell action color in table rows: `color: tx.action === 'buy' ? 'var(--pnl-up)' : 'var(--pnl-down)'`
- Inline add-transaction form panel (`txForm`): `background: var(--bg-table-header)`, `border: 1px solid var(--border)`
- Save button inside the add-transaction form (`submitBtn`): use `--btn-primary-*` tokens (`background: var(--btn-primary-bg)`, `color: var(--btn-primary-text)`)
- Back button: use `--btn-secondary-*` tokens; "+ Add Transaction" toggle button: use `--btn-primary-*` tokens
- Replace all hardcoded colors with CSS variables

### `client/src/components/AddAssetModal.jsx`
- Overlay backdrop: `rgba(0,0,0,0.6)`
- Modal panel: `background: var(--bg-card)`, `border: 1px solid var(--border)`
- Inputs and selects: `background: var(--input-bg)`, `border: 1px solid var(--input-border)`, `color: var(--input-text)`
- Cancel button: `--btn-secondary-*` tokens; Submit button: `--btn-primary-*` tokens
- Replace all hardcoded colors with CSS variables

### `client/src/components/AddValuationModal.jsx`
- Same modal, input, and button treatment as `AddAssetModal`

---

## Toggle Button

Placed in the dashboard header, to the left of Logout. Renders ☀️ when in dark mode (click switches to light), 🌙 when in light mode (click switches to dark). Styled as a secondary button using `--btn-secondary-*` tokens.

The toggle lives only on `DashboardPage`. Since it persists to `localStorage` and the init code in `main.jsx` applies the attribute before first render, the preference carries correctly across all pages and page reloads.

---

## Out of Scope

- System preference auto-detection (`prefers-color-scheme`) — always starts dark
- Animations or transitions between themes
- Any backend changes
- New npm packages
