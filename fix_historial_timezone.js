// fix_historial_timezone.js — node fix_historial_timezone.js
// Corrige el SP obtener_historial para comparar fechas usando
// la hora de Guadalajara (America/Mexico_City = UTC-6/UTC-5)
// en lugar de UTC, que es lo que usa el servidor de filess.io.
require('dotenv').config();
const db = require('./db/database');

async function run() {

  // Verificar la zona horaria actual de MySQL
  const [tzRows] = await db.query("SELECT @@global.time_zone AS global_tz, @@session.time_zone AS session_tz, NOW() AS ahora_mysql, UTC_TIMESTAMP() AS ahora_utc");
  console.log('\nZona horaria MySQL:');
  console.table(tzRows);

  // Verificar tomas recientes
  const [tomas] = await db.query('SELECT id, fecha_programada, estado, DATE(fecha_programada) AS fecha_utc, CONVERT_TZ(fecha_programada, \'+00:00\', \'-06:00\') AS fecha_mx FROM tomas ORDER BY id DESC LIMIT 5');
  console.log('\nÚltimas tomas (comparando UTC vs México):');
  console.table(tomas);

  // Recrear SP con conversión de zona horaria
  await db.query('DROP PROCEDURE IF EXISTS obtener_historial');
  await db.query(`
    CREATE PROCEDURE obtener_historial(
      IN p_id_paciente INT,
      IN p_desde       DATE,
      IN p_hasta       DATE,
      IN p_pagina      INT,
      IN p_por_pagina  INT
    )
    BEGIN
      DECLARE v_offset INT DEFAULT (p_pagina - 1) * p_por_pagina;
      SELECT t.id, t.fecha_programada, t.fecha_confirmada,
             t.estado, t.metodo, t.nivel_escalamiento,
             m.nombre AS medicamento
        FROM tomas t
        JOIN horarios     h ON h.id = t.id_horario
        JOIN medicamentos m ON m.id = h.id_medicamento
       WHERE t.id_paciente = p_id_paciente
         AND DATE(CONVERT_TZ(t.fecha_programada, '+00:00', '-06:00')) BETWEEN p_desde AND p_hasta
       ORDER BY t.fecha_programada DESC
       LIMIT p_por_pagina OFFSET v_offset;
    END
  `);
  console.log('\n✅ SP obtener_historial actualizado — ahora usa hora de Guadalajara (UTC-6)');

  // También corregir calcular_adherencia que usa la misma comparación de fecha
  await db.query('DROP PROCEDURE IF EXISTS calcular_adherencia');
  await db.query(`
    CREATE PROCEDURE calcular_adherencia(IN p_id_paciente INT, IN p_semanas INT)
    BEGIN
      SELECT
        YEARWEEK(CONVERT_TZ(fecha_programada, '+00:00', '-06:00'), 1) AS semana,
        COUNT(*)                                                        AS programadas,
        SUM(estado = 'tomado')                                          AS tomadas,
        ROUND(SUM(estado = 'tomado') * 100.0 / COUNT(*), 1)            AS porcentaje
      FROM tomas
      WHERE id_paciente = p_id_paciente
        AND CONVERT_TZ(fecha_programada, '+00:00', '-06:00') >= DATE_SUB(NOW(), INTERVAL p_semanas WEEK)
      GROUP BY semana
      ORDER BY semana;
    END
  `);
  console.log('✅ SP calcular_adherencia actualizado — ahora usa hora de Guadalajara');

  // Verificar inmediatamente si las tomas de hoy aparecerían
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  const [prueba] = await db.query('CALL obtener_historial(?, ?, ?, 1, 50)', [
    // Usar el id_paciente de una toma existente para la prueba
    tomas[0]?.id_paciente ?? 1,
    hoyStr,
    hoyStr
  ]);
  console.log(`\nPrueba — tomas de hoy (${hoyStr}) para paciente ${tomas[0]?.id_paciente ?? 1}:`);
  if (prueba[0]?.length) {
    console.table(prueba[0].map(t => ({ id: t.id, medicamento: t.medicamento, estado: t.estado, hora: t.fecha_programada })));
  } else {
    console.log('  Sin tomas hoy para ese paciente (puede ser normal si no hay horario activo hoy)');
  }

  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
