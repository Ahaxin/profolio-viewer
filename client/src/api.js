async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include', // send cookies
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) =>
    apiFetch('/api/auth/login', { method: 'POST', body: { username, password } }),

  logout: () =>
    apiFetch('/api/auth/logout', { method: 'POST' }),

  getPortfolio: () =>
    apiFetch('/api/portfolio'),

  addAsset: (data) =>
    apiFetch('/api/assets', { method: 'POST', body: data }),

  deleteAsset: (id) =>
    apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),

  addTransaction: (data) =>
    apiFetch('/api/transactions', { method: 'POST', body: data }),

  getTransactions: (assetId) =>
    apiFetch(`/api/transactions/${assetId}`),

  addValuation: (data) =>
    apiFetch('/api/flat-valuations', { method: 'POST', body: data }),

  getPrice: (symbol, type) =>
    apiFetch(`/api/prices/${symbol}?type=${type}`),
};
