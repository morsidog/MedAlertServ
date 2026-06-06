// infrastructure/medicamentoRepository.js
const db = require('../db/database');

async function crear(nombre, dosis_mg, instrucciones, color_pastilla, creado_por) {
  const [rows] = await db.query(
    `INSERT INTO medicamentos (nombre, dosis_mg, instrucciones, color_pastilla, creado_por)
     VALUES (?, ?, ?, ?, ?)`,
    [nombre, dosis_mg, instrucciones ?? null, color_pastilla ?? null, creado_por]
  );
  return obtenerPorId(rows.insertId);
}

async function obtenerTodos() {
  const [rows] = await db.query(
    'SELECT id, nombre, dosis_mg, instrucciones, color_pastilla FROM medicamentos ORDER BY nombre'
  );
  return rows;
}

async function obtenerPorId(id) {
  const [rows] = await db.query(
    'SELECT id, nombre, dosis_mg, instrucciones, color_pastilla FROM medicamentos WHERE id = ?',
    [id]
  );
  return rows[0] ?? null;
}

async function actualizar(id, campos) {
  const { nombre, dosis_mg, instrucciones, color_pastilla } = campos;
  await db.query(
    `UPDATE medicamentos
        SET nombre        = COALESCE(?, nombre),
            dosis_mg      = COALESCE(?, dosis_mg),
            instrucciones = COALESCE(?, instrucciones),
            color_pastilla= COALESCE(?, color_pastilla)
      WHERE id = ?`,
    [nombre ?? null, dosis_mg ?? null, instrucciones ?? null, color_pastilla ?? null, id]
  );
  return obtenerPorId(id);
}

async function eliminar(id) {
  await db.query('DELETE FROM medicamentos WHERE id = ?', [id]);
}

module.exports = { crear, obtenerTodos, obtenerPorId, actualizar, eliminar };
