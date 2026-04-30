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
