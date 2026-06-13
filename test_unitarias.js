// test_unitarias.js
// Pruebas unitarias sin framework — usa el módulo assert de Node.
// Correr con: node test_unitarias.js
//
// Cubre:
//   1. crearHorario acepta fecha_especifica = hoy (sin desfase UTC)
//   3. crearHorario rechaza compartimento fuera de rango (1-4)
//   5. iniciarSesion rechaza credenciales incorrectas (401)
//   6. puede_ver_paciente niega acceso a familiar no vinculado

require('dotenv').config();
const assert        = require('assert');
const db            = require('./db/database');
const horarioService = require('./application/horarioService');
const authService    = require('./application/authService');

let pasaron = 0;
let fallaron = 0;

async function test(nombre, fn) {
  try {
    await fn();
    console.log(` PASÓ: ${nombre}`);
    pasaron++;
  } catch (e) {
    console.log(` FALLÓ: ${nombre}`);
    console.log(`   → ${e.message}`);
    fallaron++;
  }
}

// ─────────────────────────────────────────────────────────────────
// Prueba 1: Toma individual con fecha de HOY no debe rechazarse
// como "fecha en el pasado" (bug de desfase UTC vs hora local)
// ─────────────────────────────────────────────────────────────────
async function test1_fechaHoyNoEsPasado() {
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  // IDs de prueba — ajustar según los datos existentes en tu base de datos
  const ID_PACIENTE_PRUEBA    = 1;
  const ID_MEDICAMENTO_PRUEBA = 1;

  const resultado = await horarioService.crearHorario({
    id_paciente:      ID_PACIENTE_PRUEBA,
    id_medicamento:   ID_MEDICAMENTO_PRUEBA,
    hora:             '23:59',          // hora tardía para no chocar con el cron real
    compartimento:    1,
    fecha_especifica: hoyStr
  });

  assert.ok(resultado, 'Se esperaba que crearHorario devolviera el horario creado');

  // fecha_especifica puede venir como objeto Date (mysql2) o como string
  // "YYYY-MM-DD" dependiendo del driver/config. Normalizamos a YYYY-MM-DD
  // usando los componentes LOCALES de la fecha antes de comparar.
  let fechaResultado;
  const valor = resultado.fecha_especifica;
  if (valor instanceof Date) {
    fechaResultado = `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  } else {
    fechaResultado = String(valor).slice(0, 10);
  }

  console.log(`   Fecha enviada (hoy):        ${hoyStr}`);
  console.log(`   Fecha devuelta por el servidor: ${fechaResultado}`);

  assert.strictEqual(fechaResultado, hoyStr);
}

// ─────────────────────────────────────────────────────────────────
// Prueba 3: compartimento fuera de rango (1-4) debe rechazarse con 400
// ─────────────────────────────────────────────────────────────────
async function test3_compartimentoFueraDeRango() {
  let error = null;
  try {
    await horarioService.crearHorario({
      id_paciente:    1,
      id_medicamento: 1,
      hora:           '08:00',
      compartimento:  5,           // inválido: debe ser 1-4
      dias:           '1,2,3'
    });
  } catch (e) {
    error = e;
  }

  assert.ok(error, 'Se esperaba que crearHorario lanzara un error');
  console.log(`   Error devuelto por el servidor: [${error.status}] ${error.message}`);
  assert.strictEqual(error.status, 400, `Se esperaba status 400, se obtuvo ${error.status}`);
}

// ─────────────────────────────────────────────────────────────────
// Prueba 5: login con contraseña incorrecta devuelve 401
// con mensaje "Credenciales incorrectas"
// ─────────────────────────────────────────────────────────────────
async function test5_loginCredencialesIncorrectas() {
  // Ajustar a un correo que SÍ exista en la base de datos de prueba,
  // pero con una contraseña deliberadamente incorrecta.
  const CORREO_EXISTENTE = 'medico1@gmail.com';

  let error = null;
  try {
    await authService.iniciarSesion(CORREO_EXISTENTE, 'contraseña__');
  } catch (e) {
    error = e;
  }

  assert.ok(error, 'Se esperaba que iniciarSesion lanzara un error');
  console.log(`   Error devuelto por el servidor: [${error.status}] ${error.message}`);
  assert.strictEqual(error.status, 401, `Se esperaba status 401, se obtuvo ${error.status}`);
  assert.strictEqual(error.message, 'Credenciales incorrectas');
}

// ─────────────────────────────────────────────────────────────────
// Prueba 6: un familiar NO vinculado a un paciente no debe poder verlo
// (SP puede_ver_paciente debe devolver permitido = 0)
// ─────────────────────────────────────────────────────────────────
async function test6_familiarNoVinculadoSinAcceso() {
  // IDs de prueba — usar una cuenta de tipo "familiar" que exista
  // pero que NO esté en la tabla familiares_paciente para este paciente.
  const ID_CUENTA_FAMILIAR_NO_VINCULADO = 34; // ajustar a un id real de prueba
  const ID_PACIENTE_PRUEBA              = 1;

  const [rows] = await db.query(
    'CALL puede_ver_paciente(?, ?)',
    [ID_CUENTA_FAMILIAR_NO_VINCULADO, ID_PACIENTE_PRUEBA]
  );

  const permitido = rows[0][0]?.permitido;
  assert.strictEqual(Number(permitido), 0, 'Un familiar no vinculado no debería tener acceso (permitido debe ser 0)');
}

// ─────────────────────────────────────────────────────────────────
// Ejecutar todas las pruebas
// ─────────────────────────────────────────────────────────────────
(async () => {
  console.log('── Ejecutando pruebas unitarias ──\n');

  await test('1. Toma individual con fecha de hoy es aceptada', test1_fechaHoyNoEsPasado);
  await test('2. Compartimento fuera de rango (5) es rechazado con 400', test3_compartimentoFueraDeRango);
  await test('3. Login con contraseña incorrecta devuelve 401', test5_loginCredencialesIncorrectas);
  await test('4. Familiar no vinculado no puede ver al paciente', test6_familiarNoVinculadoSinAcceso);

  console.log(`\n── Resultado: ${pasaron} pasaron, ${fallaron} fallaron ──`);
  process.exit(fallaron > 0 ? 1 : 0);
})();