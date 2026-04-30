import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function TransactionHistoryPage() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTx, setShowAddTx] = useState(false);
  const [form, setForm] = useState({ action: 'buy', quantity: '', price_usd: '', date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');

  async function load() {
    try {
      const txs = await api.getTransactions(assetId);
      setTransactions(txs);
    } catch { navigate('/login'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [assetId]);

  async function handleAddTx(e) {
    e.preventDefault();
    setError('');
    try {
      await api.addTransaction({
        asset_id: parseInt(assetId),
        ...form,
        quantity: parseFloat(form.quantity),
        price_usd: parseFloat(form.price_usd),
      });
      setShowAddTx(false);
      load();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <div style={styles.center}>Loading…</div>;

  return (
    <div style={styles.page}>
      <button onClick={() => navigate('/')} style={styles.backBtn}>← Back to Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Transaction History</h2>
        <button onClick={() => setShowAddTx(!showAddTx)} style={styles.addBtn}>+ Add Transaction</button>
      </div>

      {showAddTx && (
        <form onSubmit={handleAddTx} style={styles.txForm}>
          <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} style={styles.inp}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <input placeholder="Quantity" type="number" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required style={styles.inp} />
          <input placeholder="Price (USD)" type="number" step="any" value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))} required style={styles.inp} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={styles.inp} />
          {error && <span style={{ color: 'var(--pnl-down)' }}>{error}</span>}
          <button type="submit" style={styles.submitBtn}>Save</button>
        </form>
      )}

      {transactions.length === 0
        ? <p style={{ color: 'var(--text-secondary)' }}>No transactions yet.</p>
        : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Date', 'Action', 'Quantity', 'Price (USD)', 'Total (USD)'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={styles.td}>{tx.date}</td>
                  <td style={{
                    ...styles.td,
                    color: tx.action === 'buy' ? 'var(--pnl-up)' : 'var(--pnl-down)',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                  }}>{tx.action}</td>
                  <td style={styles.td}>{tx.quantity}</td>
                  <td style={styles.td}>${tx.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={styles.td}>${(tx.quantity * tx.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '800px', margin: '0 auto', padding: '1.5rem' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
  backBtn: {
    marginBottom: '1rem',
    padding: '6px 12px',
    border: '1px solid var(--btn-secondary-border)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)',
  },
  addBtn: {
    padding: '8px 16px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  txForm: {
    display: 'flex',
    gap: '8px',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    padding: '1rem',
    background: 'var(--bg-table-header)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
  },
  inp: {
    padding: '8px',
    border: '1px solid var(--input-border)',
    borderRadius: '6px',
    background: 'var(--input-bg)',
    color: 'var(--input-text)',
  },
  submitBtn: {
    padding: '8px 16px',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: {
    padding: '8px 12px',
    textAlign: 'left',
    background: 'var(--bg-table-header)',
    borderBottom: '2px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
};
