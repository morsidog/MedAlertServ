// application/arduinoService.js
const arduinoRepository = require('../infrastructure/arduinoRepository');

/**
 * Devuelve el próximo comando pendiente formateado para el ESP32.
 * Formato: "DISPENSE:<compartimento>:<toma_id>:<medicamento>:<dosis>"
 */
async function obtenerComandoPendiente(device_id) {
  if (!device_id) {
    throw { status: 400, message: 'device_id es obligatorio' };
  }

  // Ping para saber que el dispositivo sigue vivo
  await arduinoRepository.registrarPing(device_id);

  const cmd = await arduinoRepository.obtenerComandoPendiente(device_id);
  return cmd ? { comando: cmd.comando, id_toma: cmd.id_toma } : { comando: '' };
}

/**
 * Confirma una toma recibida del ESP32 (método pir o pin).
 */
async function confirmarToma(toma_id, metodo, device_id) {
  if (!toma_id || !metodo || !device_id) {
    throw { status: 400, message: 'toma_id, metodo y device_id son obligatorios' };
  }

  const metodosValidos = ['pir', 'pin'];
  if (!metodosValidos.includes(metodo)) {
    throw { status: 400, message: `metodo debe ser: ${metodosValidos.join(' | ')}` };
  }

  const resultado = await arduinoRepository.confirmarToma(toma_id, metodo);

  if (resultado?.afectadas === 0) {
    throw { status: 404, message: 'Toma no encontrada o ya confirmada' };
  }

  return { ok: true, toma_id, metodo };
}

module.exports = { obtenerComandoPendiente, confirmarToma };
