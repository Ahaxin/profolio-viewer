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
