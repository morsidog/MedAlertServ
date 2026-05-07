const express = require('express');
const router = express.Router();
const db = require('../db/database');

// POST /api/auth/registro
router.post('/registro', async (req, res) => {
  try {
    const { nombre, correo, contraseña } = req.body;
    if (!correo || !contraseña || !nombre) {
      return res.status(400).json({ ok: false, error: 'Correo, Nombre y contraseña son obligatorios' });
    }
    const [rows] = await db.query('CALL registrarse(?, ?, ?)', [nombre, correo, contraseña]);
    res.status(201).json({ok: true ,cuenta:rows[0][0]});
  } catch (err) {
    res.status(400).json({ok:false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { correo, contraseña } = req.body;
     if (!correo || !contraseña) {
      return res.status(400).json({ ok: false, error: 'Correo y contraseña son obligatorios' });
    }
    const [rows] = await db.query('CALL iniciar_sesion(?, ?)', [correo, contraseña]);
    res.status(200).json({ok: true ,cuenta:rows[0][0]});
  } catch (err) {
    res.status(400).json({ ok:false, error: err.message });
  }
});

module.exports = router;