// test_horarios.js
const assert = require('assert');
const horarioService = require('./application/horarioService');

async function test1_fechaHoyNoEsPasado() {
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  try {
    await horarioService.crearHorario({
      id_paciente: 1, id_medicamento: 1, hora: '14:00',
      compartimento: 1, fecha_especifica: hoyStr
    });
    console.log('✅ Test 1 PASÓ: fecha de hoy aceptada');
  } catch (e) {
    console.log('❌ Test 1 FALLÓ:', e.message);
  }
}

async function test2_horaInvalida() {
  try {
    await horarioService.crearHorario({
      id_paciente: 1, id_medicamento: 1, hora: '8:00',
      compartimento: 1, dias: '1,2,3'
    });
    console.log('❌ Test 2 FALLÓ: debería haber rechazado la hora');
  } catch (e) {
    assert.strictEqual(e.status, 400);
    console.log('✅ Test 2 PASÓ:', e.message);
  }
}

(async () => {
  await test1_fechaHoyNoEsPasado();
  await test2_horaInvalida();
})();