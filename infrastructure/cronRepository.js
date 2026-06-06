// infrastructure/cronRepository.js
const db = require('../db/database');

async function obtenerHorariosActivos() {
  const [rows] = await db.query('CALL obtener_horarios_activos()');
  return rows[0];
}

async function registrarToma(id_horario, id_paciente, fecha) {
  const [rows] = await db.query(
    'CALL registrar_toma(?, ?, ?)',
    [id_horario, id_paciente, fecha]
  );
  return rows[0][0]?.id_toma ?? null;
}

async function encolarComando(device_id, id_toma, comando) {
  await db.query(
    `INSERT INTO comandos_arduino (device_id, id_toma, comando)
     VALUES (?, ?, ?)`,
    [device_id, id_toma, comando]
  );
}

async function desactivarHorario(id_horario) {
  await db.query('CALL desactivar_si_una_sola_vez(?)', [id_horario]);
}

module.exports = { obtenerHorariosActivos, registrarToma, encolarComando, desactivarHorario };
