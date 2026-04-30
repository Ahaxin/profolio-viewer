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
      await api.addTransaction({ asset_id: parseInt(assetId), ...form, quantity: parseFloat(form.quantity), price_usd: parseFloat(form.price_usd) });
      setShowAddTx(false);
      load();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <div style={center}>Loading…</div>;

  return (
    <div style={page}>
      <button onClick={() => navigate('/')} style={backBtn}>← Back to Dashboard</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Transaction History</h2>
        <button onClick={() => setShowAddTx(!showAddTx)} style={addBtn}>+ Add Transaction</button>
      </div>

      {showAddTx && (
        <form onSubmit={handleAddTx} style={txForm}>
          <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} style={inp}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <input placeholder="Quantity" type="number" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required style={inp} />
          <input placeholder="Price (USD)" type="number" step="any" value={form.price_usd} onChange={e => setForm(f => ({ ...f, price_usd: e.target.value }))} required style={inp} />
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required style={inp} />
          {error && <span style={{ color: '#dc2626' }}>{error}</span>}
          <button type="submit" style={submitBtn}>Save</button>
        </form>
      )}

      {transactions.length === 0
        ? <p style={{ color: '#64748b' }}>No transactions yet.</p>
        : (
          <table style={table}>
            <thead>
              <tr>
                {['Date', 'Action', 'Quantity', 'Price (USD)', 'Total (USD)'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td style={td}>{tx.date}</td>
                  <td style={{ ...td, color: tx.action === 'buy' ? '#16a34a' : '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>{tx.action}</td>
                  <td style={td}>{tx.quantity}</td>
                  <td style={td}>${tx.price_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td style={td}>${(tx.quantity * tx.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

const page = { maxWidth: '800px', margin: '0 auto', padding: '1.5rem' };
const center = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' };
const backBtn = { marginBottom: '1rem', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', background: '#fff' };
const addBtn = { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const txForm = { display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap', padding: '1rem', background: '#f8fafc', borderRadius: '6px' };
const inp = { padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' };
const submitBtn = { padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' };
const th = { padding: '8px 12px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' };
const td = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' };
