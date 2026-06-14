// debug_toma_hoy.js — node debug_toma_hoy.js
require('dotenv').config();
const db = require('./db/database');

async function run() {
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

  const [rows] = await db.query(`
    SELECT t.id AS toma_id, t.id_horario, t.id_paciente,
           t.estado, t.fecha_programada,
           p.nombre AS paciente, p.id AS paciente_id,
           m.nombre AS medicamento,
           h.hora, h.dias,
           DATE(CONVERT_TZ(t.fecha_programada, '+00:00', '-06:00')) AS fecha_mx
      FROM tomas t
      JOIN horarios     h ON h.id = t.id_horario
      JOIN medicamentos m ON m.id = h.id_medicamento
      JOIN pacientes    p ON p.id = t.id_paciente
     WHERE DATE(CONVERT_TZ(t.fecha_programada, '+00:00', '-06:00')) = ?
     ORDER BY t.fecha_programada
  `, [hoyStr]);

  console.log(`\nTomas de hoy ${hoyStr} con detalle:`);
  console.table(rows.map(r => ({
    toma_id:    r.toma_id,
    paciente:   r.paciente,
    paciente_id: r.paciente_id,
    medicamento: r.medicamento,
    hora:       r.hora,
    estado:     r.estado,
    fecha_mx:   r.fecha_mx
  })));

  // Ver qué id_paciente tienen las cuentas
  const [cuentas] = await db.query(`
    SELECT c.id AS cuenta_id, c.nombre, c.correo, t.tipo AS rol, c.id_paciente
      FROM cuentas c
      JOIN tipos_cuenta t ON t.id = c.tipo
     ORDER BY c.id
  `);
  console.log('\nCuentas y sus id_paciente:');
  console.table(cuentas);

  process.exit(0);
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
