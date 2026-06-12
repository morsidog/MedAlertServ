// routes/health.js  (HU-39)
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      db:     'ok',
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db:     'unreachable',
      uptime: process.uptime()
    });
  }
});

module.exports = router;
