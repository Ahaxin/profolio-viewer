import { useState } from 'react';
import { api } from '../api';

const ASSET_TYPES = ['stock', 'crypto', 'flat', 'other'];

export default function AddAssetModal({ onClose, onSuccess }) {
  const [type, setType] = useState('stock');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [action, setAction] = useState('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [valuationValue, setValuationValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isFlat = type === 'flat' || type === 'other';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const asset = await api.addAsset({ type, symbol, name });
      if (isFlat) {
        if (valuationValue) {
          await api.addValuation({ asset_id: asset.id, value_usd: parseFloat(valuationValue), date });
        }
      } else {
        if (quantity && price) {
          await api.addTransaction({ asset_id: asset.id, action, quantity: parseFloat(quantity), price_usd: parseFloat(price), date });
        }
      }
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
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Add Asset</h2>
        <form onSubmit={handleSubmit} style={form}>
          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value)} style={input}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Symbol (e.g. AAPL, BTC, My Flat)">
            <input value={symbol} onChange={e => setSymbol(e.target.value)} required style={input} />
          </Field>
          <Field label="Display Name">
            <input value={name} onChange={e => setName(e.target.value)} required style={input} />
          </Field>

          {!isFlat && (
            <>
              <Field label="Action">
                <select value={action} onChange={e => setAction(e.target.value)} style={input}>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
              </Field>
              <Field label="Quantity">
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} style={input} />
              </Field>
              <Field label="Price per unit (USD)">
                <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} style={input} />
              </Field>
            </>
          )}

          {isFlat && (
            <Field label="Initial Valuation (USD)">
              <input type="number" step="any" value={valuationValue} onChange={e => setValuationValue(e.target.value)} style={input} />
            </Field>
          )}

          <Field label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required style={input} />
          </Field>

          {error && <p style={{ color: 'var(--pnl-down)', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={cancelBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={submitBtn}>{loading ? 'Adding…' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</label>
      {children}
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
  width: '400px',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: 'var(--shadow)',
};
const form = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const input = {
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
