// infrastructure/notificacionRepository.js
const db = require('../db/database');

/**
 * Obtiene el token FCM de una cuenta específica
 */
async function obtenerToken(id_cuenta) {
  const [rows] = await db.query(
    'SELECT token FROM fcm_tokens WHERE id_cuenta = ?',
    [id_cuenta]
  );
  return rows[0]?.token ?? null;
}

/**
 * Guarda o actualiza el token FCM de una cuenta
 */
async function guardarToken(id_cuenta, token) {
  await db.query(
    `INSERT INTO fcm_tokens (id_cuenta, token)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), actualizado = NOW()`,
    [id_cuenta, token]
  );
}

/**
 * Obtiene todos los tokens FCM de familiares de un paciente
 */
async function obtenerTokensFamiliares(id_paciente) {
  const [rows] = await db.query(
    `SELECT f.id_familiar, ft.token, fp.es_principal
       FROM familiares_paciente fp
       JOIN fcm_tokens ft ON ft.id_cuenta = fp.id_familiar
       JOIN cuentas f ON f.id = fp.id_familiar
      WHERE fp.id_paciente = ? AND ft.token IS NOT NULL`,
    [id_paciente]
  );
  return rows;
}

/**
 * Obtiene el token FCM del médico de un paciente
 */
async function obtenerTokenMedico(id_paciente) {
  const [rows] = await db.query(
    `SELECT ft.token
       FROM pacientes p
       JOIN fcm_tokens ft ON ft.id_cuenta = p.id_medico
      WHERE p.id = ?`,
    [id_paciente]
  );
  return rows[0]?.token ?? null;
}

/**
 * Obtiene los datos de una toma con info del paciente y medicamento
 */
async function obtenerDatosToma(id_toma) {
  const [rows] = await db.query(
    `SELECT t.id, t.estado, t.fecha_programada, t.nivel_escalamiento,
            t.id_paciente,
            p.nombre AS nombre_paciente,
            m.nombre AS medicamento,
            m.dosis_mg
       FROM tomas t
       JOIN horarios h    ON h.id = t.id_horario
       JOIN medicamentos m ON m.id = h.id_medicamento
       JOIN pacientes p   ON p.id = t.id_paciente
      WHERE t.id = ?`,
    [id_toma]
  );
  return rows[0] ?? null;
}

/**
 * Actualiza el nivel de escalamiento de una toma
 */
async function actualizarNivel(id_toma, nivel) {
  await db.query(
    'UPDATE tomas SET nivel_escalamiento = ? WHERE id = ?',
    [nivel, id_toma]
  );
}

/**
 * Marca una toma como omitida
 */
async function marcarOmitida(id_toma) {
  await db.query(
    `UPDATE tomas
        SET estado = 'omitido', nivel_escalamiento = 4
      WHERE id = ? AND estado = 'pendiente'`,
    [id_toma]
  );
}

/**
 * Registra una alerta enviada
 */
async function registrarAlerta(id_toma, nivel) {
  await db.query(
    'INSERT INTO alertas (id_toma, nivel) VALUES (?, ?)',
    [id_toma, nivel]
  );
}

/**
 * Obtiene tomas pendientes que necesitan escalamiento
 * según los minutos transcurridos desde la hora programada
 */
async function obtenerTomasPendientesParaEscalar(minutosMin, minutosMax, nivelActual) {
  const [rows] = await db.query(
    `SELECT t.id, t.id_paciente, t.fecha_programada, t.nivel_escalamiento
       FROM tomas t
      WHERE t.estado = 'pendiente'
        AND t.nivel_escalamiento = ?
        AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) >= ?
        AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) < ?`,
    [nivelActual, minutosMin, minutosMax]
  );
  return rows;
}

module.exports = {
  obtenerToken, guardarToken,
  obtenerTokensFamiliares, obtenerTokenMedico,
  obtenerDatosToma, actualizarNivel, marcarOmitida,
  registrarAlerta, obtenerTomasPendientesParaEscalar
};
