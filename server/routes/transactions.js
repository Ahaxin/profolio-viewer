const express = require('express');

function createTransactionsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, action, quantity, price_usd, date } = req.body;
    if (!asset_id || !action || !quantity || !price_usd || !date) {
      return res.status(400).json({ error: 'asset_id, action, quantity, price_usd, date are required' });
    }
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'action must be buy or sell' });
    }

    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const result = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, date) VALUES (?,?,?,?,?)'
    ).run(asset_id, action, quantity, price_usd, date);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.get('/:assetId', (req, res) => {
    const txs = db.prepare(
      'SELECT * FROM transactions WHERE asset_id = ? ORDER BY date DESC, created_at DESC'
    ).all(req.params.assetId);
    res.json(txs);
  });

  return router;
}

module.exports = { createTransactionsRouter };
