// check_horarios_hoy.js — node check_horarios_hoy.js
// Muestra qué horarios están activos y si el cron debería crear tomas hoy
require('dotenv').config();
const db = require('./db/database');

async function run() {
  const ahora = new Date();
  const horaLocal = `${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}`;
  const diaISO   = ahora.getDay() === 0 ? 7 : ahora.getDay();
  const fechaHoy = `${ahora.getFullYear()}-${String(ahora.getMonth()+1).padStart(2,'0')}-${String(ahora.getDate()).padStart(2,'0')}`;

  console.log(`\nAhora (hora local proceso Node): ${ahora.toLocaleString('es-MX')}`);
  console.log(`Hora: ${horaLocal}  Día ISO: ${diaISO}  Fecha: ${fechaHoy}`);

  // Ver horarios activos
  const [horarios] = await db.query(`
    SELECT h.id, h.hora, h.dias, h.fecha_especifica, h.una_sola_vez,
           h.activo, m.nombre AS medicamento, p.nombre AS paciente,
           p.dispositivo_id
      FROM horarios h
      JOIN medicamentos m ON m.id = h.id_medicamento
      JOIN pacientes   p ON p.id = h.id_paciente
     WHERE h.activo = 1 AND p.activo = 1
     ORDER BY h.hora
  `);
  console.log('\nHorarios activos:');
  console.table(horarios.map(h => ({
    id: h.id,
    paciente: h.paciente,
    medicamento: h.medicamento,
    hora: h.hora,
    dias: h.dias,
    fecha_esp: h.fecha_especifica,
    dispositivo: h.dispositivo_id
  })));

  // Ver tomas de hoy (con el fix de timezone)
  const [tomas] = await db.query(`
    SELECT t.id, t.fecha_programada, t.estado, m.nombre AS medicamento,
           DATE(CONVERT_TZ(t.fecha_programada, '+00:00', '-06:00')) AS fecha_mx
      FROM tomas t
      JOIN horarios h ON h.id = t.id_horario
      JOIN medicamentos m ON m.id = h.id_medicamento
     WHERE DATE(CONVERT_TZ(t.fecha_programada, '+00:00', '-06:00')) = ?
     ORDER BY t.fecha_programada DESC
  `, [fechaHoy]);
  console.log(`\nTomas del día ${fechaHoy} (hora México):`);
  if (tomas.length) console.table(tomas);
  else console.log('  Sin tomas para hoy — el cron aún no ha disparado o no hay horario activo para hoy');

  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
