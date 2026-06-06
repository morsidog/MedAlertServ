// middlewares/auth.js
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'medalert_secret_dev';

/**
 * Middleware que verifica el token JWT en el header Authorization.
 * Si es válido, agrega req.usuario = { id, nombre, correo, rol }
 */
function verificarToken(req, res, next) {
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

/**
 * Middleware de roles — se usa después de verificarToken.
 * Ejemplo: router.get('/ruta', verificarToken, soloRoles('medico','admin'), handler)
 */
function soloRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({ ok: false, error: 'Sin permisos para esta acción' });
    }
    next();
  };
}

/**
 * Genera un token JWT para una cuenta.
 * payload: { id, nombre, correo, rol }
 */
function generarToken(cuenta) {
  return jwt.sign(
    { id: cuenta.id, nombre: cuenta.nombre, correo: cuenta.correo, rol: cuenta.rol },
    SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { verificarToken, soloRoles, generarToken };
