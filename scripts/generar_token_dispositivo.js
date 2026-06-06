// scripts/generar_token_dispositivo.js
// Ejecutar una sola vez: node scripts/generar_token_dispositivo.js
// Copia el token generado y pégalo en el .ino como DEVICE_TOKEN

require('dotenv').config();
const { generarToken } = require('../middlewares/auth');

const tokenDispositivo = generarToken({
  id:     0,
  nombre: 'ESP32-DISP-001',
  correo: 'dispositivo@medalert',
  rol:    'dispositivo'
});

console.log('\n✅ Token del dispositivo (sin expiración práctica — 100 años):');
console.log(tokenDispositivo);
console.log('\nPégalo en el .ino como:');
console.log(`const char* DEVICE_TOKEN = "${tokenDispositivo}";\n`);
