// infrastructure/horarioRepository.js
const db = require('../db/database');

async function crear(id_paciente, id_medicamento, hora, dias, compartimento, fecha_especifica, una_sola_vez) {
  try {
    const [rows] = await db.query(
      'CALL crear_horario(?, ?, ?, ?, ?, ?, ?)',
      [id_paciente, id_medicamento, hora, dias, compartimento,
       fecha_especifica ?? null, una_sola_vez ?? 0]
    );
    return rows[0][0];
  } catch (err) {
    if (err.sqlState === '45000') throw { status: 400, message: err.message };
    throw { status: 500, message: 'Error al crear horario' };
  }
}

async function obtenerPorPaciente(id_paciente) {
  const [rows] = await db.query(
    `SELECT h.id, h.hora, h.dias, h.compartimento, h.activo,
            h.fecha_especifica, h.una_sola_vez,
            m.id AS id_medicamento, m.nombre AS medicamento,
            m.dosis_mg, m.instrucciones, m.color_pastilla
       FROM horarios h
       JOIN medicamentos m ON m.id = h.id_medicamento
      WHERE h.id_paciente = ?
      ORDER BY h.una_sola_vez ASC, h.hora ASC`,
    [id_paciente]
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await db.query(
    `SELECT h.id, h.hora, h.dias, h.compartimento, h.activo,
            h.fecha_especifica, h.una_sola_vez,
            m.id AS id_medicamento, m.nombre AS medicamento,
            m.dosis_mg, m.instrucciones
       FROM horarios h
       JOIN medicamentos m ON m.id = h.id_medicamento
      WHERE h.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

async function verificarConflicto(id_paciente, compartimento, hora, dias, excluir_id = null) {
  const [rows] = await db.query(
    `SELECT id, dias FROM horarios
      WHERE id_paciente   = ?
        AND compartimento = ?
        AND hora          = ?
        AND activo        = 1
        AND una_sola_vez  = 0
        AND (? IS NULL OR id != ?)`,
    [id_paciente, compartimento, hora, excluir_id, excluir_id]
  );
  const diasNuevos = String(dias).split(',').map(Number);
  for (const h of rows) {
    const diasExistentes = String(h.dias).split(',').map(Number);
    if (diasNuevos.some(d => diasExistentes.includes(d))) return true;
  }
  return false;
}

async function desactivar(id) {
  await db.query('UPDATE horarios SET activo = 0 WHERE id = ?', [id]);
}

async function activar(id) {
  await db.query('UPDATE horarios SET activo = 1 WHERE id = ?', [id]);
}

module.exports = { crear, obtenerPorPaciente, obtenerPorId, verificarConflicto, desactivar, activar };
