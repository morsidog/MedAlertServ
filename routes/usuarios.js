// routes/usuarios.js
const express                       = require('express');
const router                        = express.Router();
const { verificarToken }            = require('../middlewares/auth');
const { registrarToken }            = require('../application/notificacionService');

/**
 * POST /api/usuarios/fcm-token
 * Body: { token: "FCM_TOKEN_DEL_DISPOSITIVO" }
 * La app Android llama esto al iniciar sesión
 */
router.post('/fcm-token', verificarToken, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: 'token es obligatorio' });
    await registrarToken(req.usuario.id, token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
