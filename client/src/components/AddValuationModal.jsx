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
