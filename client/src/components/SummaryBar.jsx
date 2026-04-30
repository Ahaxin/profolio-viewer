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
