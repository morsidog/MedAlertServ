// routes/admin.js
const express                       = require('express');
const router                        = express.Router();
const { verificarToken, soloRoles } = require('../middlewares/auth');
const db                            = require('../db/database');

router.use(verificarToken, soloRoles('admin'));

// GET /api/admin/fcm-tokens (HU-43)
router.get('/fcm-tokens', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id AS usuario_id, c.nombre, t.tipo AS rol,
             LEFT(ft.token, 8) AS token_preview,
             ft.actualizado
        FROM fcm_tokens ft
        JOIN cuentas c ON c.id = ft.id_cuenta
        JOIN tipos_cuenta t ON t.id = c.tipo
       ORDER BY ft.actualizado DESC
    `);
    res.json({ ok: true, tokens: rows });
  } catch (err) { next(err); }
});

module.exports = router;
