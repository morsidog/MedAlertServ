// infrastructure/notificacionRepository.js
const db = require('../db/database');

async function obtenerToken(id_paciente) {
  const [rows] = await db.query(
    `SELECT ft.token
       FROM fcm_tokens ft
       JOIN cuentas c ON c.id = ft.id_cuenta
      WHERE c.id_paciente = ?
      LIMIT 1`,
    [id_paciente]
  );
  return rows[0]?.token ?? null;
}

async function guardarToken(id_cuenta, token) {
  await db.query(
    `INSERT INTO fcm_tokens (id_cuenta, token)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE token = VALUES(token), actualizado = NOW()`,
    [id_cuenta, token]
  );
}

async function obtenerTokensFamiliares(id_paciente) {
  const [rows] = await db.query(
    `SELECT fp.id_familiar, ft.token, fp.es_principal
       FROM familiares_paciente fp
       JOIN fcm_tokens ft ON ft.id_cuenta = fp.id_familiar
      WHERE fp.id_paciente = ? AND ft.token IS NOT NULL`,
    [id_paciente]
  );
  return rows;
}

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

async function obtenerDatosToma(id_toma) {
  const [rows] = await db.query(
    `SELECT t.id, t.id_paciente, t.fecha_programada,
            p.nombre AS nombre_paciente,
            m.nombre AS medicamento, m.dosis_mg
       FROM tomas t
       JOIN horarios     h ON h.id = t.id_horario
       JOIN medicamentos m ON m.id = h.id_medicamento
       JOIN pacientes    p ON p.id = t.id_paciente
      WHERE t.id = ?`,
    [id_toma]
  );
  return rows[0] ?? null;
}

async function actualizarNivel(id_toma, nivel) {
  await db.query('UPDATE tomas SET nivel_escalamiento = ? WHERE id = ?', [nivel, id_toma]);
}

async function registrarAlerta(id_toma, nivel) {
  await db.query(
    'INSERT INTO alertas (id_toma, nivel) VALUES (?, ?)',
    [id_toma, nivel]
  );
}

async function marcarOmitida(id_toma) {
  await db.query(
    "UPDATE tomas SET estado = 'omitido' WHERE id = ? AND estado = 'pendiente'",
    [id_toma]
  );
}

// Busca tomas que:
// - están pendientes con el nivel actual
// - llevan al menos minutosMin minutos desde la hora programada
// - llevan MENOS de minutosMax minutos (para no saltarse niveles)
// Si minutosMax es null, no hay techo (usado para omitida)
async function obtenerTomasPendientesParaEscalar(minutosMin, minutosMax, nivelActual) {
  let query, params;
  if (minutosMax === null) {
    query = `SELECT t.id, t.id_paciente FROM tomas t
              WHERE t.estado = 'pendiente'
                AND t.nivel_escalamiento = ?
                AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) >= ?`;
    params = [nivelActual, minutosMin];
  } else {
    query = `SELECT t.id, t.id_paciente FROM tomas t
              WHERE t.estado = 'pendiente'
                AND t.nivel_escalamiento = ?
                AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) >= ?
                AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) < ?`;
    params = [nivelActual, minutosMin, minutosMax];
  }
  const [rows] = await db.query(query, params);
  return rows;
}

module.exports = {
  obtenerToken, guardarToken,
  obtenerTokensFamiliares, obtenerTokenMedico,
  obtenerDatosToma, actualizarNivel, registrarAlerta,
  marcarOmitida, obtenerTomasPendientesParaEscalar
};
