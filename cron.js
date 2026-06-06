// cron.js  (raíz del proyecto, junto a server.js)
// Se importa una sola vez desde server.js con: require('./cron')

const cron           = require('node-cron');
const { checkHorarios } = require('./application/cronService');

// Cada minuto en punto: segundo 0 de cada minuto
// Expresión: '0 * * * * *'  →  s m h d M dow
cron.schedule('0 * * * * *', async () => {
  try {
    await checkHorarios();
  } catch (err) {
    console.error('[Cron] Error inesperado:', err.message);
  }
});

console.log('[Cron] ✅ checkHorarios activo — evaluando cada minuto');
