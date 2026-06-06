// routes/auth.js
const express          = require('express');
const router           = express.Router();
const authService      = require('../application/authService');
const { generarToken } = require('../middlewares/auth');

router.post('/registro', async (req, res, next) => {
  try {
    const { nombre, correo, contraseña, rol } = req.body;
    const cuenta = await authService.registrarse(nombre, correo, contraseña, rol);
    const token  = generarToken(cuenta);
    res.status(201).json({ ok: true, cuenta, token });
  } catch (err) {
    next(err);
  }
});

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
