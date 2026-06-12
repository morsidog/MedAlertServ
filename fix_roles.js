require('dotenv').config();
const db = require('./db/database');

async function run() {
  // crear_cuenta_paciente — tipo=2 es paciente, no 3
  await db.query('DROP PROCEDURE IF EXISTS crear_cuenta_paciente');
  await db.query(`
    CREATE PROCEDURE crear_cuenta_paciente(
      IN p_nombre     VARCHAR(100),
      IN p_correo     VARCHAR(100),
      IN p_contrasena VARCHAR(255),
      IN p_id_paciente INT
    )
    BEGIN
      DECLARE v_existe INT DEFAULT 0;
      SELECT COUNT(*) INTO v_existe FROM cuentas WHERE correo = p_correo;
      IF v_existe > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo ya está registrado';
      END IF;
      INSERT INTO cuentas (nombre, correo, contraseña, tipo, id_paciente)
        VALUES (p_nombre, p_correo, p_contrasena, 2, p_id_paciente);
      SELECT id, nombre, correo FROM cuentas WHERE id = LAST_INSERT_ID();
    END
  `);
  console.log('crear_cuenta_paciente actualizado (tipo=2)');

  // vincular_cuenta_paciente — busca tipo=2 (paciente), no 3
  await db.query('DROP PROCEDURE IF EXISTS vincular_cuenta_paciente');
  await db.query(`
    CREATE PROCEDURE vincular_cuenta_paciente(
      IN p_correo     VARCHAR(100),
      IN p_id_paciente INT
    )
    BEGIN
      DECLARE v_id INT DEFAULT NULL;
      SELECT id INTO v_id FROM cuentas
       WHERE correo = p_correo AND tipo = 2 LIMIT 1;
      IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se encontró cuenta de paciente con ese correo';
      END IF;
      UPDATE cuentas SET id_paciente = p_id_paciente WHERE id = v_id;
      SELECT id, nombre, correo FROM cuentas WHERE id = v_id;
    END
  `);
  console.log('vincular_cuenta_paciente actualizado (tipo=2)');

  // vincular_familiar — confirma que familiar=4 (correcto, sin cambio necesario)
  // pero lo recreamos por seguridad con el mismo valor
  await db.query('DROP PROCEDURE IF EXISTS vincular_familiar');
  await db.query(`
    CREATE PROCEDURE vincular_familiar(
      IN p_correo_familiar VARCHAR(100),
      IN p_id_paciente     INT,
      IN p_es_principal    TINYINT(1)
    )
    BEGIN
      DECLARE v_id_familiar INT DEFAULT NULL;
      DECLARE v_tipo INT DEFAULT NULL;
      SELECT id, tipo INTO v_id_familiar, v_tipo FROM cuentas
       WHERE correo = p_correo_familiar AND activo = 1 LIMIT 1;
      IF v_id_familiar IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se encontró una cuenta con ese correo';
      END IF;
      IF v_tipo != 4 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cuenta no tiene rol de familiar';
      END IF;
      INSERT IGNORE INTO familiares_paciente (id_paciente, id_familiar, es_principal)
        VALUES (p_id_paciente, v_id_familiar, p_es_principal);
      SELECT f.id, c.nombre, c.correo, f.es_principal
        FROM familiares_paciente f
        JOIN cuentas c ON c.id = f.id_familiar
       WHERE f.id_paciente = p_id_paciente AND f.id_familiar = v_id_familiar;
    END
  `);
  console.log('vincular_familiar verificado (familiar=4)');

  console.log('\n✅ Listo');
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
