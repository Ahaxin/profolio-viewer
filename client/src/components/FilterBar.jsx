const TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function FilterBar({ filterTypes, onToggle }) {
  return (
    <div style={styles.bar}>
      <span style={styles.label}>Show:</span>
      {TYPES.map(t => {
        const active = filterTypes.has(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            style={{ ...styles.chip, ...(active ? styles.chipActive : styles.chipInactive) }}
          >
            {t}
          </button>
        );
      })}
      {filterTypes.size === 0 && (
        <span style={styles.hint}>0 selected — showing all</span>
      )}
    </div>
  );
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 1rem', flexWrap: 'wrap' },
  label: { fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  chip: {
    padding: '4px 12px', borderRadius: '999px', cursor: 'pointer',
    fontSize: '0.8rem', fontWeight: '500', textTransform: 'capitalize',
    transition: 'all 0.15s',
  },
  chipActive: {
    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
    border: '1px solid var(--btn-primary-bg)',
  },
  chipInactive: {
    background: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  hint: { fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' },
};
