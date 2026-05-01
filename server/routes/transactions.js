const express = require('express');

function createTransactionsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, action, quantity, price_usd, date, remarks } = req.body;
    if (!asset_id || !action || !quantity || !price_usd || !date) {
      return res.status(400).json({ error: 'asset_id, action, quantity, price_usd, date are required' });
    }
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'action must be buy or sell' });
    }
    if (quantity <= 0 || price_usd <= 0 || isNaN(quantity) || isNaN(price_usd)) {
      return res.status(400).json({ error: 'quantity and price_usd must be positive numbers' });
    }
    if (remarks !== undefined && remarks !== null && remarks !== '') {
      if (typeof remarks !== 'string' || remarks.length > 500) {
        return res.status(400).json({ error: 'remarks must be a string of 500 characters or fewer' });
      }
    }

    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const result = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, date, remarks) VALUES (?,?,?,?,?,?)'
    ).run(asset_id, action, quantity, price_usd, date, remarks || null);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  // IMPORTANT: /export must be registered BEFORE /:assetId
  router.get('/export', (req, res) => {
    const rows = db.prepare(`
      SELECT t.id, t.date, t.action, t.quantity, t.price_usd,
             (t.quantity * t.price_usd) AS total_usd,
             t.remarks,
             a.name AS asset_name, a.symbol, a.type
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      ORDER BY t.date DESC, t.created_at DESC
    `).all();
    res.json(rows);
  });

  router.get('/:assetId', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    const txs = db.prepare(
      'SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.params.assetId);
    res.json(txs);
  });

  return router;
}

module.exports = { createTransactionsRouter };
