import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function PnlCell({ value, pct, style }) {
  if (value == null) return <td style={{ ...styles.td, ...style }}>—</td>;
  const color = value >= 0 ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <td style={{ ...styles.td, color, fontWeight: '600', ...style }}>
      {value >= 0 ? '+' : ''}${value.toFixed(2)}
      {pct != null && (
        <span style={{ fontSize: '0.75rem', marginLeft: '4px', opacity: 0.85 }}>
          ({pct >= 0 ? '+' : ''}{pct}%)
        </span>
      )}
    </td>
  );
}

function PriceCell({ price, stale, style }) {
  if (price == null) return <td style={{ ...styles.td, ...style, color: 'var(--text-secondary)' }}>—</td>;
  return (
    <td style={{ ...styles.td, ...style }}>
      ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      {stale && <span title="Price may be outdated" style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>}
    </td>
  );
}

export default function AssetTable({ assets, onDelete, onAddValuation, onEdit }) {
  const navigate = useNavigate();
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  if (!assets.length) {
    return <p style={{ color: 'var(--text-secondary)' }}>No assets yet. Click "Add Asset" to get started.</p>;
  }

  const grouped = Object.values(
    assets.reduce((acc, asset) => {
      const key = asset.name.trim().toLowerCase();
      if (!acc[key]) acc[key] = { key, name: asset.name, items: [] };
      acc[key].items.push(asset);
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const rows = [];

  for (const { key, name, items } of grouped) {
    const isMulti = items.length > 1;
    const isExpanded = expandedGroups.has(key);

    if (!isMulti) {
      const asset = items[0];
      rows.push(<AssetRow key={asset.id} asset={asset} hovered={hoveredRow === asset.id}
        onHover={setHoveredRow} onNavigate={navigate}
        onDelete={onDelete} onEdit={onEdit} onAddValuation={onAddValuation} />);
      continue;
    }

    // Aggregate summary values
    const totalQty = items.reduce((s, i) => s + (i.net_quantity || 0), 0);
    const weightedAvgBuy = totalQty
      ? items.reduce((s, i) => s + (i.avg_buy_price || 0) * (i.net_quantity || 0), 0) / totalQty
      : null;
    const totalValue = items.reduce((s, i) => s + (i.current_value || 0), 0);
    const allHavePnl = items.every(i => i.pnl_usd != null);
    const totalPnl = allHavePnl ? items.reduce((s, i) => s + i.pnl_usd, 0) : null;
    const costBasis = items.reduce((s, i) => s + (i.avg_buy_price || 0) * (i.net_quantity || 0), 0);
    const totalPnlPct = costBasis > 0 && totalPnl != null ? +((totalPnl / costBasis) * 100).toFixed(2) : null;
    const currentPrice = items.find(i => i.current_price != null)?.current_price ?? null;
    const priceStale = items.some(i => i.price_stale);
    const updatedAt = items.find(i => i.price_updated_at)?.price_updated_at ?? null;

    // Summary / group header row
    rows.push(
      <tr key={`grp-${key}`} style={{ ...styles.row, background: 'var(--bg-table-header)' }}
        onClick={() => toggleGroup(key)}>
        <td style={styles.td}>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{isExpanded ? '▼' : '▶'}</span>
            {name}
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
              ({items.length})
            </span>
          </div>
        </td>
        <td style={styles.td}><span style={styles.badge}>{items[0].type}</span></td>
        <td style={styles.td}><strong style={{ color: 'var(--text-muted)' }}>{items[0].symbol}</strong></td>
        <td style={styles.td}>{totalQty.toFixed(4)}</td>
        <td style={styles.td}>{weightedAvgBuy != null ? `$${weightedAvgBuy.toFixed(2)}` : '—'}</td>
        <PriceCell price={currentPrice} stale={priceStale} />
        <td style={styles.td}>{totalValue > 0 ? `$${totalValue.toLocaleString()}` : '—'}</td>
        <PnlCell value={totalPnl} pct={totalPnlPct} />
        <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {updatedAt ? new Date(updatedAt).toLocaleTimeString() : '—'}
        </td>
        <td style={styles.td} onClick={e => e.stopPropagation()} />
      </tr>
    );

    if (isExpanded) {
      items.forEach(asset => {
        rows.push(
          <AssetRow key={asset.id} asset={asset} hovered={hoveredRow === asset.id}
            onHover={setHoveredRow} onNavigate={navigate}
            onDelete={onDelete} onEdit={onEdit} onAddValuation={onAddValuation}
            indent />
        );
      });
    }
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
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function AssetRow({ asset, hovered, onHover, onNavigate, onDelete, onEdit, onAddValuation, indent }) {
  return (
    <tr
      style={{ ...styles.row, background: hovered ? 'var(--row-hover)' : 'transparent' }}
      onClick={() => onNavigate(`/assets/${asset.id}`)}
      onMouseEnter={() => onHover(asset.id)}
      onMouseLeave={() => onHover(null)}
    >
      <td style={{ ...styles.td, paddingLeft: indent ? '28px' : undefined }}>
        {!indent && <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{asset.name}</div>}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: indent ? 0 : '2px' }}>{asset.symbol}</div>
      </td>
      <td style={styles.td}><span style={styles.badge}>{asset.type}</span></td>
      <td style={styles.td}><strong style={{ color: 'var(--text-muted)' }}>{asset.symbol}</strong></td>
      <td style={styles.td}>{asset.net_quantity != null ? asset.net_quantity : '—'}</td>
      <td style={styles.td}>{asset.avg_buy_price != null ? `$${asset.avg_buy_price.toFixed(2)}` : '—'}</td>
      <PriceCell price={asset.current_price} stale={asset.price_stale} />
      <td style={styles.td}>{asset.current_value != null ? `$${asset.current_value.toLocaleString()}` : '—'}</td>
      <PnlCell value={asset.pnl_usd} pct={asset.pnl_pct} />
      <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {asset.price_updated_at ? new Date(asset.price_updated_at).toLocaleTimeString() : '—'}
      </td>
      <td style={styles.td} onClick={e => e.stopPropagation()}>
        {(asset.type === 'flat' || asset.type === 'other') && (
          <button style={styles.actionBtn} onClick={() => onAddValuation(asset)}>+ Val</button>
        )}
        <button style={{ ...styles.actionBtn, color: 'var(--pnl-down)', borderColor: 'var(--pnl-down)' }}
          onClick={() => onDelete(asset.id)}>Del</button>
      </td>
    </tr>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    padding: '8px 12px', textAlign: 'left', background: 'var(--bg-table-header)',
    borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
    color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
  row: { cursor: 'pointer', transition: 'background 0.15s' },
  badge: {
    background: 'var(--badge-bg)', color: 'var(--text-muted)', borderRadius: '4px',
    padding: '2px 6px', fontSize: '0.75rem', whiteSpace: 'nowrap',
  },
  actionBtn: {
    marginRight: '4px', padding: '2px 8px', border: '1px solid var(--btn-secondary-border)',
    borderRadius: '4px', cursor: 'pointer', background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)', fontSize: '0.75rem',
  },
};
