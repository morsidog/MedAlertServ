require('dotenv').config();
const db = require('./database');

async function init() {
  try {

    await db.query(`
      CREATE TABLE IF NOT EXISTS tipos_cuenta (
        id   INT AUTO_INCREMENT PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL
      )
    `);
    console.log('✅ tipos_cuenta creada');

    await db.query(`
      CREATE TABLE IF NOT EXISTS cuentas (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        nombre      VARCHAR(100) NOT NULL,
        correo      VARCHAR(100) UNIQUE NOT NULL,
        contraseña  VARCHAR(255) NOT NULL,
        id_paciente INT,
        tipo        INT NOT NULL,
        FOREIGN KEY (id_paciente) REFERENCES cuentas(id),
        FOREIGN KEY (tipo)        REFERENCES tipos_cuenta(id)
      )
    `);
    console.log('✅ cuentas creada');

    await db.query(`
      CREATE TABLE IF NOT EXISTS alarmas_programadas (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        id_paciente   INT NOT NULL,
        medicina      VARCHAR(100) NOT NULL,
        configuracion JSON,
        FOREIGN KEY (id_paciente) REFERENCES cuentas(id)
      )
    `);
    console.log('✅ alarmas_programadas creada');

    await db.query(`
      CREATE TABLE IF NOT EXISTS registro (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        id_alarma INT NOT NULL,
        estado    VARCHAR(50) NOT NULL,
        fecha     DATE NOT NULL,
        hora      TIME NOT NULL,
        FOREIGN KEY (id_alarma) REFERENCES alarmas_programadas(id)
      )
    `);
    console.log('✅ registro creada');

    console.log('\n🎉 Todas las tablas creadas correctamente');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

init();