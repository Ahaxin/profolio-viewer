const express = require('express');

const VALID_TYPES = ['stock', 'crypto', 'flat', 'other'];

function createAssetsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { type, symbol, name } = req.body;
    if (!type || !symbol || !name) {
      return res.status(400).json({ error: 'type, symbol, and name are required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    try {
      const result = db.prepare('INSERT INTO assets (type, symbol, name) VALUES (?, ?, ?)').run(type, symbol.toUpperCase(), name);
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

  router.delete('/:id', (req, res) => {
    const asset = db.prepare('SELECT id FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createAssetsRouter };
