// cron.js
const cron                    = require('node-cron');
const { checkHorarios }       = require('./application/cronService');
const { checkEscalamiento }   = require('./application/notificacionService');

// Cada minuto — detecta horarios y dispara comandos al ESP32
cron.schedule('0 * * * * *', async () => {
  try { await checkHorarios(); }
  catch (err) { console.error('[Cron] checkHorarios error:', err.message); }
});

// Cada minuto — revisa escalamiento de alertas FCM
cron.schedule('0 * * * * *', async () => {
  try { await checkEscalamiento(); }
  catch (err) { console.error('[Cron] checkEscalamiento error:', err.message); }
});

console.log('[Cron] ✅ checkHorarios + checkEscalamiento activos — cada minuto');