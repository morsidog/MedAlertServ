// fix_login_id_paciente.js — node fix_login_id_paciente.js
require('dotenv').config();
const db = require('./db/database');

async function run() {
  // ── iniciar_sesion ─────────────────────────────────────────────
  await db.query('DROP PROCEDURE IF EXISTS iniciar_sesion');
  await db.query(`
    CREATE PROCEDURE iniciar_sesion(
      IN p_correo     VARCHAR(100),
      IN p_contrasena VARCHAR(255)
    )
    BEGIN
      DECLARE v_id INT DEFAULT NULL;
      SELECT id INTO v_id FROM cuentas
       WHERE correo = p_correo AND contraseña = p_contrasena
       LIMIT 1;
      IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Credenciales incorrectas';
      END IF;
      SELECT c.id, c.nombre, c.correo, t.tipo AS rol, c.id_paciente
        FROM cuentas c
        JOIN tipos_cuenta t ON t.id = c.tipo
       WHERE c.id = v_id;
    END
  `);
  console.log('✅ iniciar_sesion actualizado — ahora devuelve id_paciente');

  // ── registrarse ────────────────────────────────────────────────
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
      DECLARE v_tipo   INT DEFAULT 3;
      SELECT COUNT(*) INTO v_existe FROM cuentas WHERE correo = p_correo;
      IF v_existe > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo ya está registrado';
      END IF;
      SET v_tipo = IF(p_tipo IN (1,2,3,4), p_tipo, 3);
      INSERT INTO cuentas (nombre, correo, contraseña, tipo)
        VALUES (p_nombre, p_correo, p_contrasena, v_tipo);
      SELECT c.id, c.nombre, c.correo, t.tipo AS rol, c.id_paciente
        FROM cuentas c
        JOIN tipos_cuenta t ON t.id = c.tipo
       WHERE c.id = LAST_INSERT_ID();
    END
  `);
  console.log('✅ registrarse actualizado — ahora devuelve id_paciente (NULL en cuentas nuevas)');

  console.log('\n⚠️  Importante: las sesiones ya guardadas en localStorage del navegador');
  console.log('   no tienen id_paciente. Los usuarios deben CERRAR SESIÓN y volver a');
  console.log('   INICIAR SESIÓN una vez para que se guarde el dato actualizado.');

  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

