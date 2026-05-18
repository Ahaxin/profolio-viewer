import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ModifyAssetModal({ asset, onClose, onSuccess }) {
  const [name, setName] = useState(asset.name || '');
  const [comment, setComment] = useState(asset.comment || '');
  const [latestTx, setLatestTx] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [valuationValue, setValuationValue] = useState(
    asset.latest_valuation ? String(asset.latest_valuation.value_usd) : ''
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isFlat = asset.type === 'flat' || asset.type === 'other';
  const currency = asset.currency || 'USD';

  useEffect(() => {
    if (isFlat) return;
    api.getTransactions(asset.id).then(txs => {
      const latest = txs[0];
      if (latest) {
        setLatestTx(latest);
        setQuantity(String(latest.quantity));
        setPrice(String(latest.price_native ?? latest.price_usd));
      }
    }).catch(() => {});
  }, [asset.id, isFlat]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.patchAsset(asset.id, {
        name: name.trim(),
        comment: comment.trim() || null,
      });

      if (!isFlat && latestTx) {
        const newQty = parseFloat(quantity);
        const newPrice = parseFloat(price);
        if (!isNaN(newQty) && !isNaN(newPrice) &&
            (newQty !== latestTx.quantity || newPrice !== (latestTx.price_native ?? latestTx.price_usd))) {
          await api.updateTransaction(latestTx.id, { quantity: newQty, price_native: newPrice });
        }
      }

      if (isFlat && asset.latest_valuation) {
        const newVal = parseFloat(valuationValue);
        if (!isNaN(newVal) && newVal !== asset.latest_valuation.value_usd) {
          await api.updateValuation(asset.latest_valuation.id, { value_usd: newVal });
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
        <h2 style={{ margin: '0 0 1rem', color: 'var(--text-primary)' }}>Modify Asset</h2>
        <form onSubmit={handleSubmit} style={form}>
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)} required style={input} />
          </Field>
          <Field label="Comment">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Optional note about this asset"
            />
          </Field>

          {!isFlat && latestTx && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Latest transaction ({latestTx.action}, {latestTx.date}). For older transactions, use Transaction History.
              </div>
              <Field label="Quantity">
                <input type="number" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} style={input} />
              </Field>
              <Field label={`Price per unit (${currency})`}>
                <input type="number" step="any" value={price} onChange={e => setPrice(e.target.value)} style={input} />
              </Field>
            </>
          )}

          {!isFlat && !latestTx && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              No transactions yet — quantity/price fields will appear once a transaction exists.
            </div>
          )}

          {isFlat && asset.latest_valuation && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Latest valuation ({asset.latest_valuation.date}). For older valuations, open the asset detail page.
              </div>
              <Field label="Value (USD)">
                <input type="number" step="any" value={valuationValue}
                  onChange={e => setValuationValue(e.target.value)} style={input} />
              </Field>
            </>
          )}
          {isFlat && !asset.latest_valuation && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              No valuations yet — add one from the row's "+ Val" button.
            </div>
          )}

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

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
const modal = { background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: '10px', width: 'min(420px, 92vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow)', boxSizing: 'border-box' };
const form = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
const input = { padding: '8px', border: '1px solid var(--input-border)', borderRadius: '6px', fontSize: '1rem', background: 'var(--input-bg)', color: 'var(--input-text)' };
const submitBtn = { padding: '8px 20px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' };
const cancelBtn = { padding: '8px 20px', background: 'var(--btn-secondary-bg)', border: '1px solid var(--btn-secondary-border)', color: 'var(--btn-secondary-text)', borderRadius: '6px', cursor: 'pointer' };
