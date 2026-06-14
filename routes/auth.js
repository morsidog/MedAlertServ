// routes/auth.js
const express            = require('express');
const router             = express.Router();
const authService        = require('../application/authService');
const { generarToken }   = require('../middlewares/auth');

/**
 * POST /api/auth/registro
 * Body: { nombre, correo, contraseña }
 * Respuesta: { ok, cuenta, token }
 */
router.post('/registro', async (req, res, next) => {
  try {
    const { nombre, correo, contraseña } = req.body;
    // Acepta tanto { rol: 'familiar' } (web) como { tipo: 4 } (app Android)
    const rol = req.body.rol ?? req.body.tipo;
    const cuenta = await authService.registrarse(nombre, correo, contraseña, rol);
    const token  = generarToken(cuenta);
    res.status(201).json({ ok: true, cuenta, token });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { correo, contraseña }
 * Respuesta: { ok, cuenta, token }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { correo, contraseña } = req.body;
    const cuenta = await authService.iniciarSesion(correo, contraseña);
    const token  = generarToken(cuenta);
    res.status(200).json({ ok: true, cuenta, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
