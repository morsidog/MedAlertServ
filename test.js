//text-conection.js
require('dotenv').config(); 
const db = require('./db/database');

async function test() {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS resultado');
    console.log('✅ Conexión exitosa:', rows[0]);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function test2() {
  const nombre = 'perrotaco'
  const contraseña = 'computadora'
  const correo = 'a23300698@ceti.mx'
  const [rows] = await db.query('CALL registrarse(?, ?, ?)', [nombre, correo, contraseña]);
  console.log(rows[0])
}

test2();
console.log("Node.js funcionando");