import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import SummaryBar from '../components/SummaryBar';
import AssetTable from '../components/AssetTable';
import AddAssetModal from '../components/AddAssetModal';
import AddValuationModal from '../components/AddValuationModal';

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [valuationAsset, setValuationAsset] = useState(null);
  const navigate = useNavigate();

  const loadPortfolio = useCallback(async () => {
    try {
      const data = await api.getPortfolio();
      setPortfolio(data);
      setError('');
    } catch (err) {
      if (err?.message === 'Not authenticated') navigate('/login');
      else setError('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadPortfolio();
    const interval = setInterval(loadPortfolio, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPortfolio]);

  async function handleDelete(assetId) {
    if (!confirm('Delete this asset and all its transactions?')) return;
    try {
      await api.deleteAsset(assetId);
      loadPortfolio();
    } catch {
      setError('Failed to delete asset');
    }
  }

  async function handleLogout() {
    await api.logout();
    navigate('/login');
  }

  if (loading) return <div style={styles.center}>Loading…</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.heading}>Portfolio</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadPortfolio} style={styles.btn}>Refresh</button>
          <button onClick={() => setShowAddAsset(true)} style={{ ...styles.btn, background: '#2563eb', color: '#fff' }}>+ Add Asset</button>
          <button onClick={handleLogout} style={{ ...styles.btn, color: '#dc2626' }}>Logout</button>
        </div>
      </header>

      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {portfolio && (
        <>
          <SummaryBar
            totalValue={portfolio.total_value}
            totalPnlUsd={portfolio.total_pnl_usd}
            totalPnlPct={portfolio.total_pnl_pct}
          />
          <AssetTable
            assets={portfolio.assets}
            onDelete={handleDelete}
            onAddValuation={setValuationAsset}
          />
        </>
      )}

      {showAddAsset && (
        <AddAssetModal
          onClose={() => setShowAddAsset(false)}
          onSuccess={() => { setShowAddAsset(false); loadPortfolio(); }}
        />
      )}

      {valuationAsset && (
        <AddValuationModal
          asset={valuationAsset}
          onClose={() => setValuationAsset(null)}
          onSuccess={() => { setValuationAsset(null); loadPortfolio(); }}
        />
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  heading: { margin: 0, fontSize: '1.75rem' },
  btn: { padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', background: '#fff' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
};
