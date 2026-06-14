// fix_solo_sp.js — node fix_solo_sp.js
// Los tipos_cuenta ya están correctos (1=usuario,2=paciente,3=medico,4=familiar).
// Solo recrea el SP registrarse con lógica robusta.
require('dotenv').config();
const db = require('./db/database');

async function run() {

  await db.query('DROP PROCEDURE IF EXISTS registrarse');
  await db.query(`
    CREATE PROCEDURE registrarse(
      IN p_nombre     VARCHAR(100),
      IN p_correo     VARCHAR(100),
      IN p_contrasena VARCHAR(255),
      IN p_tipo       INT
    )
    BEGIN
      DECLARE v_existe INT DEFAULT 0;
      DECLARE v_tipo   INT;

      SELECT COUNT(*) INTO v_existe FROM cuentas WHERE correo = p_correo;
      IF v_existe > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo ya está registrado';
      END IF;

      IF p_tipo IN (1, 2, 3, 4) THEN
        SET v_tipo = p_tipo;
      ELSE
        SET v_tipo = 2;
      END IF;

      INSERT INTO cuentas (nombre, correo, contraseña, tipo)
        VALUES (p_nombre, p_correo, p_contrasena, v_tipo);

      SELECT c.id, c.nombre, c.correo, t.tipo AS rol, c.id_paciente
        FROM cuentas c
        JOIN tipos_cuenta t ON t.id = c.tipo
       WHERE c.id = LAST_INSERT_ID();
    END
  `);
  console.log('✅ SP registrarse recreado');

  // Prueba directa del mapeo
  console.log('\nVerificación de mapeo tipo → rol:');
  for (const tipo of [2, 3, 4, 99]) {
    const v = [1,2,3,4].includes(tipo) ? tipo : 2;
    const [rows] = await db.query('SELECT tipo FROM tipos_cuenta WHERE id = ?', [v]);
    console.log(`  tipo=${tipo} → id=${v} → "${rows[0]?.tipo}"`);
  }

  console.log('\n✅ Listo. Haz push a Render.');
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
