// middlewares/auth.js
const jwt = require('jsonwebtoken');
const db  = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'medalert_secret_dev';

async function verificarToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Token requerido' });
  }
  const token = header.split(' ')[1];
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

function soloRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({ ok: false, error: 'Sin permisos para esta acción' });
    }
    next();
  };
}

function generarToken(cuenta) {
  return jwt.sign(
    { id: cuenta.id, nombre: cuenta.nombre, correo: cuenta.correo, rol: cuenta.rol },
    SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { verificarToken, soloRoles, generarToken };
