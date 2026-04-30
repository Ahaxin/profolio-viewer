import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Portfolio Viewer</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={styles.input}
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' },
  card: { background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '320px' },
  title: { margin: '0 0 1.5rem', fontSize: '1.5rem', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1rem' },
  button: { padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer' },
  error: { color: '#dc2626', margin: 0, fontSize: '0.875rem' },
};
