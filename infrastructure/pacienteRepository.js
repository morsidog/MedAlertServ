// infrastructure/pacienteRepository.js
const db = require('../db/database');

async function crear(nombre, fecha_nacimiento, diagnostico, dispositivo_id, id_medico) {
  try {
    const [rows] = await db.query(
      'CALL crear_paciente(?, ?, ?, ?, ?)',
      [nombre, fecha_nacimiento, diagnostico ?? null, dispositivo_id ?? null, id_medico]
    );
    return rows[0][0];
  } catch (err) {
    if (err.sqlState === '45000') throw { status: 400, message: err.message };
    throw { status: 500, message: 'Error al crear paciente' };
  }
}

async function obtenerTodos(id_medico) {
  const [rows] = await db.query(
    `SELECT p.id, p.nombre, p.fecha_nacimiento, p.diagnostico,
            p.dispositivo_id, p.activo, p.creado_en
       FROM pacientes p
      WHERE p.id_medico = ? AND p.activo = 1
      ORDER BY p.nombre`,
    [id_medico]
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await db.query(
    `SELECT id, nombre, fecha_nacimiento, diagnostico,
            dispositivo_id, activo, creado_en
       FROM pacientes WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

async function actualizar(id, campos) {
  const { nombre, fecha_nacimiento, diagnostico, dispositivo_id } = campos;
  await db.query(
    `UPDATE pacientes
        SET nombre           = COALESCE(?, nombre),
            fecha_nacimiento = COALESCE(?, fecha_nacimiento),
            diagnostico      = COALESCE(?, diagnostico),
            dispositivo_id   = COALESCE(?, dispositivo_id)
      WHERE id = ?`,
    [nombre ?? null, fecha_nacimiento ?? null, diagnostico ?? null, dispositivo_id ?? null, id]
  );
  return obtenerPorId(id);
}

async function desactivar(id) {
  await db.query('UPDATE pacientes SET activo = 0 WHERE id = ?', [id]);
}

module.exports = { crear, obtenerTodos, obtenerPorId, actualizar, desactivar };
