import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatNative, formatUsd } from '../format';
import { useIsMobile } from '../useIsMobile';

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

function PriceCell({ price, currency, stale, style }) {
  if (price == null) return <td style={{ ...styles.td, ...style, color: 'var(--text-secondary)' }}>—</td>;
  return (
    <td style={{ ...styles.td, ...style }}>
      {formatNative(price, currency)}
      {stale && <span title="Price may be outdated" style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>}
    </td>
  );
}

function CommentIcon({ comment }) {
  if (!comment) return null;
  return (
    <span title={comment} style={{ marginLeft: '6px', cursor: 'help', opacity: 0.7 }}>💬</span>
  );
}

const COLUMNS = [
  { key: 'name',          label: 'Name',          sortable: true },
  { key: 'type',          label: 'Type',          sortable: true },
  { key: 'symbol',        label: 'Symbol',        sortable: true },
  { key: 'net_quantity',  label: 'Qty',           sortable: true },
  { key: 'avg_buy',       label: 'Avg Buy',       sortable: true },
  { key: 'current_price', label: 'Current Price', sortable: true },
  { key: 'current_value', label: 'Value',         sortable: true },
  { key: 'pnl_usd',       label: 'P&L',           sortable: true },
  { key: 'updated_at',    label: 'Last Updated',  sortable: true },
  { key: 'actions',       label: 'Actions',       sortable: false },
];

function compareForKey(a, b, key) {
  const get = (g) => {
    switch (key) {
      case 'name':          return (g.name || '').toLowerCase();
      case 'type':          return g.type || '';
      case 'symbol':        return g.symbol || '';
      case 'net_quantity':  return g.totalQty ?? 0;
      case 'avg_buy':       return g.weightedAvgBuy ?? -Infinity;
      case 'current_price': return g.currentPrice ?? -Infinity;
      case 'current_value': return g.totalValue ?? -Infinity;
      case 'pnl_usd':       return g.totalPnl ?? -Infinity;
      case 'updated_at':    return g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
      default:              return 0;
    }
  };
  const va = get(a), vb = get(b);
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

export default function AssetTable({
  assets,
  onDelete,
  onAddValuation,
  onModify,
  filterTypes,
  sort,
  onSortChange,
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const visibleAssets = useMemo(() => {
    if (!filterTypes || filterTypes.size === 0) return assets;
    return assets.filter(a => filterTypes.has(a.type));
  }, [assets, filterTypes]);

  const grouped = useMemo(() => {
    const map = visibleAssets.reduce((acc, asset) => {
      const key = asset.name.trim().toLowerCase();
      if (!acc[key]) acc[key] = { key, name: asset.name, items: [] };
      acc[key].items.push(asset);
      return acc;
    }, {});

    const groups = Object.values(map).map(g => {
      const items = g.items;
      const totalQty = items.reduce((s, i) => s + (i.net_quantity || 0), 0);
      const weightedAvgBuyNative = totalQty
        ? items.reduce((s, i) => s + ((i.avg_buy_price_native ?? i.avg_buy_price) || 0) * (i.net_quantity || 0), 0) / totalQty
        : null;
      const weightedAvgBuy = totalQty
        ? items.reduce((s, i) => s + (i.avg_buy_price || 0) * (i.net_quantity || 0), 0) / totalQty
        : null;
      const totalValue = items.reduce((s, i) => s + (i.current_value || 0), 0);
      const allHavePnl = items.every(i => i.pnl_usd != null);
      const totalPnl = allHavePnl ? items.reduce((s, i) => s + i.pnl_usd, 0) : null;
      const costBasis = items.reduce((s, i) => s + (i.avg_buy_price || 0) * (i.net_quantity || 0), 0);
      const totalPnlPct = costBasis > 0 && totalPnl != null ? +((totalPnl / costBasis) * 100).toFixed(2) : null;
      const firstWithPrice = items.find(i => i.current_price_native != null) || items.find(i => i.current_price != null);
      const currentPriceNative = firstWithPrice?.current_price_native ?? firstWithPrice?.current_price ?? null;
      const currency = items[0].currency || 'USD';
      const priceStale = items.some(i => i.price_stale);
      const updatedAt = items.find(i => i.price_updated_at)?.price_updated_at ?? null;
      const type = items[0].type;
      const symbol = items[0].symbol;
      return {
        ...g, items, type, symbol, totalQty, weightedAvgBuy, weightedAvgBuyNative,
        totalValue, totalPnl, totalPnlPct, currentPriceNative, currency, priceStale, updatedAt,
      };
    });

    if (sort && sort.col && sort.dir) {
      groups.sort((a, b) => {
        const cmp = compareForKey(a, b, sort.col);
        return sort.dir === 'desc' ? -cmp : cmp;
      });
    } else {
      groups.sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [visibleAssets, sort]);

  if (!visibleAssets.length) {
    return <p style={{ color: 'var(--text-secondary)' }}>No assets match the current filter.</p>;
  }

  function toggleGroup(key) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const rows = [];

  for (const g of grouped) {
    const isMulti = g.items.length > 1;
    const isExpanded = expandedGroups.has(g.key);

    if (!isMulti) {
      const asset = g.items[0];
      rows.push(<AssetRow key={asset.id} asset={asset} hovered={hoveredRow === asset.id}
        onHover={setHoveredRow} onNavigate={navigate}
        onDelete={onDelete} onModify={onModify} onAddValuation={onAddValuation} />);
      continue;
    }

    const groupHasComment = g.items.some(i => i.comment);
    const groupComments = g.items.filter(i => i.comment).map(i => `• ${i.comment}`).join('\n');

    rows.push(
      <tr key={`grp-${g.key}`} style={{ ...styles.row, background: 'var(--bg-table-header)' }}
        onClick={() => toggleGroup(g.key)}>
        <td style={styles.td}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: '14px', flexShrink: 0, fontSize: '0.65rem', opacity: 0.7 }}>
              {isExpanded ? '▼' : '▶'}
            </span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{g.name}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '5px' }}>({g.items.length})</span>
            {groupHasComment && <CommentIcon comment={groupComments} />}
          </div>
        </td>
        <td style={styles.td}><span style={styles.badge}>{g.type}</span></td>
        <td style={styles.td}><strong style={{ color: 'var(--text-muted)' }}>{g.symbol}</strong></td>
        <td style={styles.td}>{g.totalQty.toFixed(4)}</td>
        <td style={styles.td}>{g.weightedAvgBuyNative != null ? formatNative(g.weightedAvgBuyNative, g.currency) : '—'}</td>
        <PriceCell price={g.currentPriceNative} currency={g.currency} stale={g.priceStale} />
        <td style={styles.td}>{g.totalValue > 0 ? formatUsd(g.totalValue) : '—'}</td>
        <PnlCell value={g.totalPnl} pct={g.totalPnlPct} />
        <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {g.updatedAt ? new Date(g.updatedAt).toLocaleTimeString() : '—'}
        </td>
        <td style={styles.td} onClick={e => e.stopPropagation()} />
      </tr>
    );

    if (isExpanded) {
      g.items.forEach(asset => {
        rows.push(
          <AssetRow key={asset.id} asset={asset} hovered={hoveredRow === asset.id}
            onHover={setHoveredRow} onNavigate={navigate}
            onDelete={onDelete} onModify={onModify} onAddValuation={onAddValuation}
            indent />
        );
      });
    }
  }

  function handleHeaderClick(col) {
    if (!col.sortable || !onSortChange) return;
    onSortChange(col.key);
  }

  function sortIndicator(colKey) {
    if (!sort || sort.col !== colKey) return null;
    return <span style={{ marginLeft: '4px', fontSize: '0.65rem' }}>{sort.dir === 'desc' ? '▼' : '▲'}</span>;
  }

  if (isMobile) {
    return (
      <MobileCardList
        groups={grouped}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
        onNavigate={navigate}
        onDelete={onDelete}
        onModify={onModify}
        onAddValuation={onAddValuation}
        sort={sort}
        onSortChange={onSortChange}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th
                key={c.key}
                style={{ ...styles.th, cursor: c.sortable && onSortChange ? 'pointer' : 'default', userSelect: 'none' }}
                onClick={() => handleHeaderClick(c)}
              >
                {c.label}{sortIndicator(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function AssetRow({ asset, hovered, onHover, onNavigate, onDelete, onModify, onAddValuation, indent }) {
  const currency = asset.currency || 'USD';
  const avgBuyNative = asset.avg_buy_price_native ?? asset.avg_buy_price;
  const currentNative = asset.current_price_native ?? asset.current_price;

  return (
    <tr
      style={{ ...styles.row, background: hovered ? 'var(--row-hover)' : 'transparent' }}
      onClick={() => onNavigate(`/assets/${asset.id}`)}
      onMouseEnter={() => onHover(asset.id)}
      onMouseLeave={() => onHover(null)}
    >
      <td style={{ ...styles.td, paddingLeft: indent ? '28px' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {!indent && <span style={{ display: 'inline-block', width: '14px', flexShrink: 0 }} />}
          <div>
            {!indent && (
              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                {asset.name}<CommentIcon comment={asset.comment} />
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: indent ? 0 : '2px' }}>
              {asset.symbol}
              {indent && <CommentIcon comment={asset.comment} />}
            </div>
          </div>
        </div>
      </td>
      <td style={styles.td}><span style={styles.badge}>{asset.type}</span></td>
      <td style={styles.td}><strong style={{ color: 'var(--text-muted)' }}>{asset.symbol}</strong></td>
      <td style={styles.td}>{asset.net_quantity != null ? asset.net_quantity : '—'}</td>
      <td style={styles.td}>{avgBuyNative != null ? formatNative(avgBuyNative, currency) : '—'}</td>
      <PriceCell price={currentNative} currency={currency} stale={asset.price_stale} />
      <td style={styles.td}>{asset.current_value != null ? formatUsd(asset.current_value) : '—'}</td>
      <PnlCell value={asset.pnl_usd} pct={asset.pnl_pct} />
      <td style={{ ...styles.td, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {asset.price_updated_at ? new Date(asset.price_updated_at).toLocaleTimeString() : '—'}
      </td>
      <td style={styles.td} onClick={e => e.stopPropagation()}>
        {(asset.type === 'flat' || asset.type === 'other') && (
          <button style={styles.actionBtn} onClick={() => onAddValuation(asset)}>+ Val</button>
        )}
        <button style={styles.actionBtn} onClick={() => onModify(asset)}>Modify</button>
        <button style={{ ...styles.actionBtn, color: 'var(--pnl-down)', borderColor: 'var(--pnl-down)' }}
          onClick={() => onDelete(asset.id)}>Del</button>
      </td>
    </tr>
  );
}

const SORTABLE_COLS = COLUMNS.filter(c => c.sortable);

function MobileCardList({ groups, expandedGroups, toggleGroup, onNavigate, onDelete, onModify, onAddValuation, sort, onSortChange }) {
  const sortCol = sort?.col ?? '';
  const sortDir = sort?.dir ?? null;

  function handleColChange(e) {
    const col = e.target.value;
    if (onSortChange && col && sort?.col !== col) onSortChange(col);
  }

  function flipDir() {
    if (onSortChange && sort?.col) onSortChange(sort.col);
  }

  return (
    <div>
      {onSortChange && (
        <div style={mobileStyles.sortBar}>
          <label style={mobileStyles.sortLabel}>Sort:</label>
          <select value={sortCol} onChange={handleColChange} style={mobileStyles.sortSelect}>
            <option value="" disabled>Choose…</option>
            {SORTABLE_COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {sortCol && (
            <button type="button" onClick={flipDir} style={mobileStyles.dirBtn}>
              {sortDir === 'desc' ? '▼ desc' : sortDir === 'asc' ? '▲ asc' : '— off'}
            </button>
          )}
        </div>
      )}

      <div style={mobileStyles.list}>
        {groups.map(g => {
          const isMulti = g.items.length > 1;
          const isExpanded = expandedGroups.has(g.key);

          if (!isMulti) {
            return (
              <MobileCard
                key={g.items[0].id}
                asset={g.items[0]}
                onNavigate={onNavigate}
                onDelete={onDelete}
                onModify={onModify}
                onAddValuation={onAddValuation}
              />
            );
          }

          const groupHasComment = g.items.some(i => i.comment);
          const groupComments = g.items.filter(i => i.comment).map(i => `• ${i.comment}`).join('\n');

          return (
            <div key={`grp-${g.key}`}>
              <div
                style={{ ...mobileStyles.card, ...mobileStyles.groupCard }}
                onClick={() => toggleGroup(g.key)}
              >
                <div style={mobileStyles.cardHeader}>
                  <div style={mobileStyles.cardTitle}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7, marginRight: '6px' }}>{isExpanded ? '▼' : '▶'}</span>
                    {g.name}
                    <span style={mobileStyles.groupCount}>({g.items.length})</span>
                    {groupHasComment && <CommentIcon comment={groupComments} />}
                  </div>
                  <span style={mobileStyles.badge}>{g.type}</span>
                </div>
                <div style={mobileStyles.metrics}>
                  <Metric label="Qty" value={g.totalQty.toFixed(4)} />
                  <Metric label="Price" value={g.currentPriceNative != null ? formatNative(g.currentPriceNative, g.currency) : '—'} />
                  <Metric label="Value" value={g.totalValue > 0 ? formatUsd(g.totalValue) : '—'} />
                  <PnlMetric value={g.totalPnl} pct={g.totalPnlPct} />
                </div>
              </div>
              {isExpanded && g.items.map(asset => (
                <MobileCard
                  key={asset.id}
                  asset={asset}
                  onNavigate={onNavigate}
                  onDelete={onDelete}
                  onModify={onModify}
                  onAddValuation={onAddValuation}
                  indent
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileCard({ asset, onNavigate, onDelete, onModify, onAddValuation, indent }) {
  const currency = asset.currency || 'USD';
  const currentNative = asset.current_price_native ?? asset.current_price;

  return (
    <div
      style={{ ...mobileStyles.card, ...(indent ? mobileStyles.cardIndent : null) }}
      onClick={() => onNavigate(`/assets/${asset.id}`)}
    >
      <div style={mobileStyles.cardHeader}>
        <div style={mobileStyles.cardTitle}>
          {asset.name}
          <CommentIcon comment={asset.comment} />
        </div>
        <span style={mobileStyles.badge}>{asset.type}</span>
      </div>
      <div style={mobileStyles.cardSubtitle}>{asset.symbol}</div>
      <div style={mobileStyles.metrics}>
        <Metric label="Qty" value={asset.net_quantity != null ? asset.net_quantity : '—'} />
        <Metric
          label="Price"
          value={currentNative != null ? formatNative(currentNative, currency) : '—'}
          stale={asset.price_stale}
        />
        <Metric label="Value" value={asset.current_value != null ? formatUsd(asset.current_value) : '—'} />
        <PnlMetric value={asset.pnl_usd} pct={asset.pnl_pct} />
      </div>
      <div style={mobileStyles.actions} onClick={e => e.stopPropagation()}>
        {(asset.type === 'flat' || asset.type === 'other') && (
          <button style={mobileStyles.actionBtn} onClick={() => onAddValuation(asset)}>+ Val</button>
        )}
        <button style={mobileStyles.actionBtn} onClick={() => onModify(asset)}>Modify</button>
        <button style={{ ...mobileStyles.actionBtn, color: 'var(--pnl-down)', borderColor: 'var(--pnl-down)' }}
          onClick={() => onDelete(asset.id)}>Del</button>
      </div>
    </div>
  );
}

function Metric({ label, value, stale }) {
  return (
    <div style={mobileStyles.metric}>
      <div style={mobileStyles.metricLabel}>{label}</div>
      <div style={mobileStyles.metricValue}>
        {value}
        {stale && <span title="Price may be outdated" style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>}
      </div>
    </div>
  );
}

function PnlMetric({ value, pct }) {
  if (value == null) {
    return <Metric label="P&L" value="—" />;
  }
  const color = value >= 0 ? 'var(--pnl-up)' : 'var(--pnl-down)';
  return (
    <div style={mobileStyles.metric}>
      <div style={mobileStyles.metricLabel}>P&amp;L</div>
      <div style={{ ...mobileStyles.metricValue, color, fontWeight: 600 }}>
        {value >= 0 ? '+' : ''}${value.toFixed(2)}
        {pct != null && (
          <span style={{ fontSize: '0.7rem', marginLeft: '4px', opacity: 0.85 }}>
            ({pct >= 0 ? '+' : ''}{pct}%)
          </span>
        )}
      </div>
    </div>
  );
}

const mobileStyles = {
  sortBar: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' },
  sortLabel: { fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  sortSelect: { padding: '6px 8px', border: '1px solid var(--input-border)', borderRadius: '6px', background: 'var(--input-bg)', color: 'var(--input-text)', fontSize: '0.85rem', flex: 1 },
  dirBtn: { padding: '6px 10px', border: '1px solid var(--btn-secondary-border)', borderRadius: '6px', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', fontSize: '0.75rem', cursor: 'pointer' },

  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem', cursor: 'pointer' },
  cardIndent: { marginLeft: '1rem', background: 'transparent' },
  groupCard: { background: 'var(--bg-table-header)' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
  cardTitle: { fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
  cardSubtitle: { fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' },
  groupCount: { fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '5px' },
  badge: { background: 'var(--badge-bg)', color: 'var(--text-muted)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem', textTransform: 'capitalize', whiteSpace: 'nowrap', flexShrink: 0 },

  metrics: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.6rem' },
  metric: { display: 'flex', flexDirection: 'column' },
  metricLabel: { fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  metricValue: { fontSize: '0.9rem', color: 'var(--text-primary)' },

  actions: { display: 'flex', gap: '6px', marginTop: '0.75rem', flexWrap: 'wrap' },
  actionBtn: { flex: '1 1 auto', minHeight: '36px', padding: '6px 10px', border: '1px solid var(--btn-secondary-border)', borderRadius: '6px', cursor: 'pointer', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', fontSize: '0.8rem' },
};

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
