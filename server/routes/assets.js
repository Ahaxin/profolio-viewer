const express = require('express');
const yahooFinance = require('../services/yahooFinance');

const VALID_TYPES = ['stock', 'crypto', 'flat', 'other'];

function createAssetsRouter(db) {
  const router = express.Router();

  const normalizeSymbol = symbol => String(symbol || '').toUpperCase().trim();

  router.post('/', (req, res) => {
    const { type, symbol, name } = req.body;
    if (!type || !symbol || !name) {
      return res.status(400).json({ error: 'type, symbol, and name are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    try {
      const normalized = normalizeSymbol(symbol);
      const seededCurrency = type === 'stock' ? yahooFinance.inferCurrencyFromSymbol(normalized) : 'USD';
      const result = db.prepare('INSERT INTO assets (type, symbol, name, currency) VALUES (?, ?, ?, ?)')
        .run(type, normalized, name.trim(), seededCurrency);
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);

      // Fire-and-forget: refine currency from Yahoo chart meta
      if (type === 'stock') {
        yahooFinance.fetchStockPrices([normalized]).then(map => {
          const info = map[normalized];
          if (info && info.currency && info.currency !== seededCurrency) {
            db.prepare('UPDATE assets SET currency = ? WHERE id = ?').run(info.currency, asset.id);
          }
        }).catch(err => console.warn(`[assets] currency refine failed for ${normalized}: ${err.message}`));
      }

      res.status(201).json(asset);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'An asset with this symbol already exists' });
      }
      console.error('[assets] error:', err);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });

  router.put('/:id', (req, res) => {
    const { type, symbol, name } = req.body;
    if (!type || !symbol || !name) {
      return res.status(400).json({ error: 'type, symbol, and name are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    try {
      db.prepare('UPDATE assets SET type = ?, symbol = ?, name = ? WHERE id = ?')
        .run(type, normalizeSymbol(symbol), name.trim(), req.params.id);
      const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'An asset with this symbol already exists' });
      }
      console.error('[assets] error:', err);
      res.status(500).json({ error: 'Failed to update asset' });
    }
  });

  router.patch('/:id', (req, res) => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const { name, comment, currency } = req.body;

    if (comment !== undefined && comment !== null) {
      if (typeof comment !== 'string' || comment.length > 500) {
        return res.status(400).json({ error: 'comment must be a string of 500 characters or fewer' });
      }
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be a non-empty string' });
    }

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (comment !== undefined) { fields.push('comment = ?'); values.push(comment === '' ? null : comment); }
    if (currency !== undefined) { fields.push('currency = ?'); values.push(currency); }
    if (!fields.length) return res.json(asset);

    values.push(req.params.id);
    db.prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id));
  });

  router.delete('/:id', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAssetsRouter };
