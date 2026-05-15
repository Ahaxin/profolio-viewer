const express = require('express');

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
      const result = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?, ?, ?)').run(type, normalizeSymbol(symbol), name.trim());
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid);
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
      db.prepare('UPDATE assets SET type = ?, symbol = ?, name = ? WHERE id = ?').run(type, normalizeSymbol(symbol), name.trim(), req.params.id);
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

  router.delete('/:id', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAssetsRouter };
