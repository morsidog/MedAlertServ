// routes/tomas.js
const express                       = require('express');
const router                        = express.Router();
const { verificarToken }            = require('../middlewares/auth');
const db                            = require('../db/database');

// POST /api/tomas/:id/confirm
// Body: { metodo: "app" }
router.post('/:id/confirm', verificarToken, async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { metodo } = req.body;

    const [rows] = await db.query(
      'CALL confirmar_toma(?, ?)',
      [id, metodo ?? 'app']
    );

    const resultado = rows[0][0];
    if (!resultado || resultado.afectadas === 0) {
      return res.status(404).json({ ok: false, error: 'Toma no encontrada o ya confirmada' });
    }

    res.json({ ok: true, toma_id: id, metodo: metodo ?? 'app' });
  } catch (err) {
    next(err);
  }
});

// GET /api/tomas — historial por paciente (alias más corto)
// Redirige a /api/pacientes/:id/historial
router.get('/', verificarToken, async (req, res) => {
  res.json({ ok: false, error: 'Usa /api/pacientes/:id/historial' });
});

module.exports = router;
