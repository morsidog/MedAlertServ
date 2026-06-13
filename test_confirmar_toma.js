// test_confirmar_toma.js
// Prueba integradora: POST /api/arduino/confirm
// Verifica el flujo completo: el ESP32 confirma una toma pendiente,
// el backend actualiza la tabla `tomas`, cancela alertas pendientes
// y marca el comando como enviado.
//
// Requiere que el servidor esté corriendo (ej. npm start) y que exista
// al menos una toma con estado 'pendiente' en la base de datos.
//
// Correr con: node test_confirmar_toma.js

require('dotenv').config();
const assert = require('assert');
const db     = require('./db/database');

// Ajustar si el servidor corre en otro puerto/host
const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const DEVICE_ID    = 'DISP-001';
const DEVICE_TOKEN = process.env.TEST_DEVICE_TOKEN || 'PEGA_AQUI_EL_TOKEN_DEL_DISPOSITIVO';

async function obtenerTomaPendiente() {
  const [rows] = await db.query(
    `SELECT id, id_paciente FROM tomas WHERE estado = 'pendiente' ORDER BY id DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

async function main() {
  console.log('── Prueba integradora: POST /api/arduino/confirm ──\n');

  // 1. Obtener una toma pendiente desde la base de datos
  const toma = await obtenerTomaPendiente();
  assert.ok(toma, 'Se necesita al menos una toma con estado "pendiente" en la base de datos para esta prueba');
  console.log(`Toma pendiente encontrada: id=${toma.id}, id_paciente=${toma.id_paciente}`);

  // 2. Confirmar la toma vía el endpoint que usa el ESP32
  const res = await fetch(`${SERVER_URL}/api/arduino/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': DEVICE_ID,
      'Authorization': `Bearer ${DEVICE_TOKEN}`,
    },
    body: JSON.stringify({
      toma_id:   toma.id,
      metodo:    'pir',
      device_id: DEVICE_ID,
    }),
  });

  const data = await res.json();
  console.log('Respuesta del servidor:', res.status, data);

  assert.ok(res.status === 200 || res.status === 201,
    `Se esperaba status 200/201, se obtuvo ${res.status}`);
  assert.strictEqual(data.ok, true, 'Se esperaba { ok: true }');

  // 3. Verificar en la base de datos que la toma cambió a "tomado"
  const [rowsToma] = await db.query(
    'SELECT estado, metodo, fecha_confirmada FROM tomas WHERE id = ?',
    [toma.id]
  );
  const tomaActualizada = rowsToma[0];
  console.log('Estado en la base de datos:', tomaActualizada);

  assert.strictEqual(tomaActualizada.estado, 'tomado',
    `Se esperaba estado = "tomado", se obtuvo "${tomaActualizada.estado}"`);
  assert.strictEqual(tomaActualizada.metodo, 'pir',
    `Se esperaba metodo = "pir", se obtuvo "${tomaActualizada.metodo}"`);
  assert.ok(tomaActualizada.fecha_confirmada !== null,
    'Se esperaba que fecha_confirmada tuviera un valor');

  // 4. Verificar que las alertas pendientes de esa toma fueron canceladas
  const [rowsAlertas] = await db.query(
    'SELECT COUNT(*) AS pendientes FROM alertas WHERE id_toma = ? AND cancelada = 0',
    [toma.id]
  );
  assert.strictEqual(Number(rowsAlertas[0].pendientes), 0,
    'Se esperaba que todas las alertas de esta toma quedaran canceladas');

  console.log('\n✅ PASÓ: confirmación de toma actualiza estado, método y cancela alertas');
  process.exit(0);
}

main().catch(e => {
  console.log('\n❌ FALLÓ:', e.message);
  process.exit(1);
});
