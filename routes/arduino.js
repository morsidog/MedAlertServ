// routes/arduino.js
const express        = require('express');
const router         = express.Router();
const arduinoService = require('../application/arduinoService');

/**
 * GET /api/arduino/pending?device_id=DISP-001
 *
 * El ESP32 llama esto cada INTERVALO_POLLING ms.
 * Responde con el próximo comando a ejecutar, o comando:'' si no hay nada.
 *
 * Ejemplo de respuesta con comando:
 *   { "ok": true, "comando": "DISPENSE:1:42:Metformina:500mg", "id_toma": 42 }
 *
 * Ejemplo sin comando pendiente:
 *   { "ok": true, "comando": "" }
 */
router.get('/pending', async (req, res, next) => {
  try {
    // device_id viene por query param O por header (el ESP32 manda los dos)
    const device_id = req.query.device_id || req.headers['x-device-id'];
    const resultado = await arduinoService.obtenerComandoPendiente(device_id);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/arduino/confirm
 *
 * Body: { toma_id: 42, metodo: "pir" | "pin", device_id: "DISP-001" }
 *
 * El ESP32 llama esto cuando el PIR detecta presencia o el usuario
 * ingresa el PIN correcto. Reintentos: hasta 3 veces (lógica en el .ino).
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const device_id = req.body.device_id || req.headers['x-device-id'];
    const { toma_id, metodo } = req.body;
    const resultado = await arduinoService.confirmarToma(toma_id, metodo, device_id);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
