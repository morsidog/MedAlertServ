// debug_escalamiento_query.js — node debug_escalamiento_query.js
require('dotenv').config();
const db = require('./db/database');

async function run() {
  // Ver tomas pendientes con todos los datos relevantes
  const [pendientes] = await db.query(`
    SELECT 
      t.id,
      t.estado,
      t.nivel_escalamiento,
      t.fecha_programada,
      NOW()                                                     AS ahora_servidor,
      TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW())          AS minutos_transcurridos,
      t.id_paciente
    FROM tomas t
    WHERE t.estado = 'pendiente'
    ORDER BY t.id DESC
    LIMIT 10
  `);
  
  console.log('\n── Tomas pendientes ──');
  console.table(pendientes.map(r => ({
    id: r.id,
    nivel: r.nivel_escalamiento,
    mins: r.minutos_transcurridos,
    fecha_programada: String(r.fecha_programada),
    ahora: String(r.ahora_servidor),
  })));

  // Simular exactamente la query de obtenerTomasPendientesParaEscalar
  console.log('\n── Simulando query nivel 0→1 (mins >= 5 AND < 15) ──');
  const [n0] = await db.query(`
    SELECT t.id, t.nivel_escalamiento,
           TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) AS mins
      FROM tomas t
     WHERE t.estado = 'pendiente'
       AND t.nivel_escalamiento = 0
       AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) >= 5
       AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) < 15
  `);
  console.log('Resultado nivel 0→1:', n0.length ? n0 : 'VACÍO');

  console.log('\n── Simulando query nivel 0→1 SIN límite superior ──');
  const [n0s] = await db.query(`
    SELECT t.id, t.nivel_escalamiento,
           TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) AS mins
      FROM tomas t
     WHERE t.estado = 'pendiente'
       AND t.nivel_escalamiento = 0
       AND TIMESTAMPDIFF(MINUTE, t.fecha_programada, NOW()) >= 5
  `);
  console.log('Resultado sin límite:', n0s.length ? n0s : 'VACÍO');

  // Ver si la toma 25 específicamente
  console.log('\n── Toma 25 específica ──');
  const [t25] = await db.query(`
    SELECT id, estado, nivel_escalamiento, fecha_programada,
           NOW() AS ahora,
           TIMESTAMPDIFF(MINUTE, fecha_programada, NOW()) AS mins
      FROM tomas WHERE id = 25
  `);
  console.table(t25);

  process.exit(0);
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
