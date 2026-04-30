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
