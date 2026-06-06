// infrastructure/authRepository.js
const db = require('../db/database');

async function crear(nombre, correo, contraseña, tipo = 3) {
  try {
    const [rows] = await db.query(
      'CALL registrarse(?, ?, ?, ?)',
      [nombre, correo, contraseña, tipo]
    );
    return rows[0][0];
  } catch (err) {
    if (err.sqlState === '45000') throw { status: 409, message: err.message };
    throw { status: 500, message: 'Error al registrar usuario' };
  }
}

async function buscarPorCredenciales(correo, contraseña) {
  try {
    const [rows] = await db.query(
      'CALL iniciar_sesion(?, ?)',
      [correo, contraseña]
    );
    const cuenta = rows[0][0];
    if (!cuenta) throw { status: 401, message: 'Credenciales incorrectas' };
    return cuenta;
  } catch (err) {
    if (err.sqlState === '45000') throw { status: 401, message: err.message };
    throw err;
  }
}

module.exports = { crear, buscarPorCredenciales };
