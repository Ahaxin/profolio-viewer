const express = require('express');

function createFlatValuationsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, value_usd, date } = req.body;
    if (!asset_id || value_usd == null || !date) {
      return res.status(400).json({ error: 'asset_id, value_usd, and date are required' });
    }
    if (isNaN(value_usd) || value_usd < 0) {
      return res.status(400).json({ error: 'value_usd must be a non-negative number' });
    }
    const asset = db.prepare("SELECT id, type FROM assets WHERE id = ?").get(asset_id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (!['flat', 'other'].includes(asset.type)) {
      return res.status(400).json({ error: 'Valuations can only be added to flat or other assets' });
    }
    const result = db.prepare(
      'INSERT INTO flat_valuations (asset_id, value_usd, date) VALUES (?,?,?)'
    ).run(asset_id, value_usd, date);
    res.status(201).json({ id: result.lastInsertRowid });
  });

  router.patch('/:id', (req, res) => {
    const v = db.prepare('SELECT * FROM flat_valuations WHERE id = ?').get(req.params.id);
    if (!v) return res.status(404).json({ error: 'Valuation not found' });

    const { value_usd, date } = req.body;
    const updates = {};
    if (value_usd !== undefined) {
      const n = Number(value_usd);
      if (isNaN(n) || n < 0) return res.status(400).json({ error: 'value_usd must be a non-negative number' });
      updates.value_usd = n;
    }
    if (date !== undefined) {
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
      }
      updates.date = date;
    }
    if (!Object.keys(updates).length) return res.json(v);

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    db.prepare(`UPDATE flat_valuations SET ${fields} WHERE id = ?`).run(...values);
    res.json(db.prepare('SELECT * FROM flat_valuations WHERE id = ?').get(req.params.id));
  });

  return router;
}

module.exports = { createFlatValuationsRouter };
