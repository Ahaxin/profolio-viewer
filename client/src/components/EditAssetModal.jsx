import { useState } from 'react';
import { api } from '../api';

const ASSET_TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function EditAssetModal({ asset, onClose, onSuccess }) {
  const [type, setType] = useState(asset.type);
  const [symbol, setSymbol] = useState(asset.symbol);
  const [name, setName] = useState(asset.name);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.updateAsset(asset.id, { type, symbol, name });
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
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Edit Asset</h2>
        <form onSubmit={handleSubmit} style={form}>
          <label style={label}>Type</label>
          <select value={type} onChange={e => setType(e.target.value)} style={input}>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <label style={label}>Symbol</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value)} required style={input} />

          <label style={label}>Display Name</label>
          <input value={name} onChange={e => setName(e.target.value)} required style={input} />

          {error && <p style={{ color: 'var(--pnl-down)', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modal = { background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '10px', width: '380px' };
const form = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
const label = { fontSize: '0.875rem', color: 'var(--text-secondary)' };
const input = { padding: '8px', border: '1px solid var(--input-border)', borderRadius: '6px', fontSize: '1rem', background: 'var(--input-bg)', color: 'var(--input-text)' };
const submitBtn = { padding: '8px 20px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' };
const cancelBtn = { padding: '8px 20px', background: 'var(--btn-secondary-bg)', border: '1px solid var(--btn-secondary-border)', color: 'var(--btn-secondary-text)', borderRadius: '6px', cursor: 'pointer' };
