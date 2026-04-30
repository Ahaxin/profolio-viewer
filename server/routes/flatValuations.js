const express = require('express');

function createFlatValuationsRouter(db) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { asset_id, value_usd, date } = req.body;
    if (!asset_id || value_usd == null || !date) {
      return res.status(400).json({ error: 'asset_id, value_usd, and date are required' });
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

  return router;
}

module.exports = { createFlatValuationsRouter };
