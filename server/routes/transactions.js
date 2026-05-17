const express = require('express');
const fxService = require('../services/fxService');

function createTransactionsRouter(db) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { asset_id, action, quantity, price_usd, price_native, date, remarks } = req.body;
    if (!asset_id || !action || !quantity || !date || (price_usd == null && price_native == null)) {
      return res.status(400).json({ error: 'asset_id, action, quantity, date, and price are required' });
    }
    if (!['buy', 'sell'].includes(action)) {
      return res.status(400).json({ error: 'action must be buy or sell' });
    }
    if (quantity <= 0 || isNaN(quantity)) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }
    if (remarks !== undefined && remarks !== null && remarks !== '') {
      if (typeof remarks !== 'string' || remarks.length > 500) {
        return res.status(400).json({ error: 'remarks must be a string of 500 characters or fewer' });
      }
    }

    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const currency = asset.currency || 'USD';
    const nativePrice = price_native != null ? Number(price_native) : Number(price_usd);
    if (nativePrice <= 0 || isNaN(nativePrice)) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }

    let usdPrice;
    if (currency === 'USD') {
      usdPrice = nativePrice;
    } else {
      try {
        const rate = await fxService.getUsdRate(db, currency);
        usdPrice = nativePrice * rate;
      } catch (err) {
        return res.status(503).json({ error: `FX rate unavailable for ${currency}, try again` });
      }
    }

    const result = db.prepare(
      'INSERT INTO transactions (asset_id, action, quantity, price_usd, price_native, date, remarks) VALUES (?,?,?,?,?,?,?)'
    ).run(asset_id, action, quantity, usdPrice, nativePrice, date, remarks || null);

    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.patch('/:id', async (req, res) => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(tx.asset_id);

    const { quantity, price_native, remarks } = req.body;
    const updates = {};

    if (quantity !== undefined) {
      const q = Number(quantity);
      if (isNaN(q) || q <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });
      updates.quantity = q;
    }
    if (price_native !== undefined) {
      const p = Number(price_native);
      if (isNaN(p) || p <= 0) return res.status(400).json({ error: 'price_native must be a positive number' });
      updates.price_native = p;
      const currency = asset.currency || 'USD';
      try {
        const rate = currency === 'USD' ? 1 : await fxService.getUsdRate(db, currency);
        updates.price_usd = p * rate;
      } catch (err) {
        return res.status(503).json({ error: `FX rate unavailable for ${currency}, try again` });
      }
    }
    if (remarks !== undefined) {
      if (remarks !== null && remarks !== '' && (typeof remarks !== 'string' || remarks.length > 500)) {
        return res.status(400).json({ error: 'remarks must be a string of 500 characters or fewer' });
      }
      updates.remarks = remarks === '' ? null : remarks;
    }

    if (!Object.keys(updates).length) return res.json(tx);

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE transactions SET ${fields} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id));
  });

  // IMPORTANT: /export must be registered BEFORE /:assetId
  router.get('/export', (req, res) => {
    const rows = db.prepare(`
      SELECT t.id, t.date, t.action, t.quantity, t.price_usd, t.price_native,
             (t.quantity * t.price_usd) AS total_usd,
             t.remarks,
             a.name AS asset_name, a.symbol, a.type, a.currency
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
