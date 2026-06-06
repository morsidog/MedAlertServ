// infrastructure/arduinoRepository.js
const db = require('../db/database');

/**
 * Devuelve el primer comando pendiente para un dispositivo.
 * Llama al SP obtener_pending_arduino(device_id).
 */
async function obtenerComandoPendiente(device_id) {
  try {
    const [rows] = await db.query(
      'CALL obtener_pending_arduino(?)',
      [device_id]
    );
    return rows[0][0] ?? null;   // null si no hay nada pendiente
  } catch (err) {
    if (err.sqlState === '45000') {
      throw { status: 400, message: err.message };
    }
    throw { status: 500, message: 'Error al consultar comando pendiente' };
  }
}

/**
 * Confirma una toma y marca el comando como enviado.
 * Llama al SP confirmar_toma(id_toma, metodo).
 */
async function confirmarToma(id_toma, metodo) {
  try {
    const [rows] = await db.query(
      'CALL confirmar_toma(?, ?)',
      [id_toma, metodo]
    );
    return rows[0][0];   // { afectadas: N }
  } catch (err) {
    if (err.sqlState === '45000') {
      throw { status: 400, message: err.message };
    }
    throw { status: 500, message: 'Error al confirmar toma' };
  }
}

/**
 * Actualiza el timestamp de último ping del dispositivo.
 */
async function registrarPing(device_id) {
  try {
    await db.query(
      `INSERT INTO dispositivos (device_id, ultimo_ping)
         VALUES (?, NOW())
       ON DUPLICATE KEY UPDATE ultimo_ping = NOW()`,
      [device_id]
    );
  } catch (_) {
    // ping no crítico, no se propaga
  }
}

module.exports = { obtenerComandoPendiente, confirmarToma, registrarPing };
