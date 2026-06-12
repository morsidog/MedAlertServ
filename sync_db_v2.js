// sync_db_v2.js — node sync_db_v2.js
require('dotenv').config();
const db = require('./db/database');

async function run() {

  // ── 1. COLUMNA password_updated_at en cuentas (HU-40) ────────────
  await safe(db.query(`
    ALTER TABLE cuentas
      ADD COLUMN IF NOT EXISTS password_updated_at DATETIME NULL DEFAULT NULL
  `), 'cuentas: password_updated_at');

  // ── 2. COLUMNA intervalo_minutos en horarios ──────────────────────
  await safe(db.query(`
    ALTER TABLE horarios
      ADD COLUMN IF NOT EXISTS intervalo_minutos INT NULL DEFAULT NULL
      COMMENT 'Si tiene valor, es alarma por intervalo. NULL = horario fijo'
  `), 'horarios: intervalo_minutos');

  // ── 3. COLUMNA firmware_version en dispositivos (HU-41) ──────────
  await safe(db.query(`
    ALTER TABLE dispositivos
      ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(20) NULL DEFAULT NULL
  `), 'dispositivos: firmware_version');

  // ── 4. SP: crear_cuenta_paciente ──────────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS crear_cuenta_paciente'), 'drop crear_cuenta_paciente');
  await safe(db.query(`
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
        VALUES (p_nombre, p_correo, p_contrasena, 3, p_id_paciente);
      SELECT id, nombre, correo FROM cuentas WHERE id = LAST_INSERT_ID();
    END
  `), 'SP crear_cuenta_paciente');

  // ── 5. SP: vincular_familiar ──────────────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS vincular_familiar'), 'drop vincular_familiar');
  await safe(db.query(`
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
  `), 'SP vincular_familiar');

  // ── 6. SP: desvincular_familiar ───────────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS desvincular_familiar'), 'drop desvincular_familiar');
  await safe(db.query(`
    CREATE PROCEDURE desvincular_familiar(
      IN p_id_familiar INT,
      IN p_id_paciente INT
    )
    BEGIN
      DELETE FROM familiares_paciente
       WHERE id_familiar = p_id_familiar AND id_paciente = p_id_paciente;
    END
  `), 'SP desvincular_familiar');

  // ── 7. SP: obtener_familiares_paciente ────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS obtener_familiares_paciente'), 'drop obtener_familiares_paciente');
  await safe(db.query(`
    CREATE PROCEDURE obtener_familiares_paciente(IN p_id_paciente INT)
    BEGIN
      SELECT f.id_familiar AS id, c.nombre, c.correo, f.es_principal
        FROM familiares_paciente f
        JOIN cuentas c ON c.id = f.id_familiar
       WHERE f.id_paciente = p_id_paciente;
    END
  `), 'SP obtener_familiares_paciente');

  // ── 8. SP: vincular_cuenta_paciente ──────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS vincular_cuenta_paciente'), 'drop vincular_cuenta_paciente');
  await safe(db.query(`
    CREATE PROCEDURE vincular_cuenta_paciente(
      IN p_correo     VARCHAR(100),
      IN p_id_paciente INT
    )
    BEGIN
      DECLARE v_id INT DEFAULT NULL;
      SELECT id INTO v_id FROM cuentas
       WHERE correo = p_correo AND tipo = 3 LIMIT 1;
      IF v_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se encontró cuenta de paciente con ese correo';
      END IF;
      UPDATE cuentas SET id_paciente = p_id_paciente WHERE id = v_id;
      SELECT id, nombre, correo FROM cuentas WHERE id = v_id;
    END
  `), 'SP vincular_cuenta_paciente');

  // ── 9. SP: crear_horario_intervalo ────────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS crear_horario_intervalo'), 'drop crear_horario_intervalo');
  await safe(db.query(`
    CREATE PROCEDURE crear_horario_intervalo(
      IN p_id_paciente      INT,
      IN p_id_medicamento   INT,
      IN p_hora_inicio      TIME,
      IN p_intervalo_min    INT,
      IN p_compartimento    TINYINT,
      IN p_dias             VARCHAR(20)
    )
    BEGIN
      DECLARE v_hora TIME DEFAULT p_hora_inicio;
      DECLARE v_count INT DEFAULT 0;
      DECLARE v_max   INT DEFAULT FLOOR(1440 / p_intervalo_min);
      -- Crea un horario por cada intervalo en el día
      WHILE v_count < v_max DO
        INSERT INTO horarios
          (id_paciente, id_medicamento, hora, dias, compartimento, intervalo_minutos)
        VALUES
          (p_id_paciente, p_id_medicamento, v_hora, p_dias, p_compartimento, p_intervalo_min);
        SET v_hora  = ADDTIME(v_hora, SEC_TO_TIME(p_intervalo_min * 60));
        SET v_count = v_count + 1;
        IF v_hora <= p_hora_inicio AND v_count > 0 THEN
          SET v_count = v_max;
        END IF;
      END WHILE;
      SELECT COUNT(*) AS horarios_creados FROM horarios
       WHERE id_paciente = p_id_paciente
         AND id_medicamento = p_id_medicamento
         AND intervalo_minutos = p_intervalo_min;
    END
  `), 'SP crear_horario_intervalo');

  // ── 10. SP: obtener_pacientes_medico (filtrado) ───────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS obtener_pacientes_medico'), 'drop obtener_pacientes_medico');
  await safe(db.query(`
    CREATE PROCEDURE obtener_pacientes_medico(IN p_id_medico INT)
    BEGIN
      SELECT p.id, p.nombre, p.fecha_nacimiento, p.diagnostico,
             p.dispositivo_id, p.activo, p.creado_en,
             -- Cuenta vinculada
             c.id AS cuenta_id, c.correo AS cuenta_correo,
             -- Familiares count
             (SELECT COUNT(*) FROM familiares_paciente fp WHERE fp.id_paciente = p.id) AS num_familiares
        FROM pacientes p
        LEFT JOIN cuentas c ON c.id_paciente = p.id AND c.tipo = 3
       WHERE p.id_medico = p_id_medico AND p.activo = 1
       ORDER BY p.nombre;
    END
  `), 'SP obtener_pacientes_medico');

  // ── 11. SP: puede_ver_paciente (control de acceso) ───────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS puede_ver_paciente'), 'drop puede_ver_paciente');
  await safe(db.query(`
    CREATE PROCEDURE puede_ver_paciente(
      IN p_id_cuenta  INT,
      IN p_id_paciente INT
    )
    BEGIN
      DECLARE v_tipo     INT DEFAULT NULL;
      DECLARE v_permitido TINYINT DEFAULT 0;
      SELECT tipo INTO v_tipo FROM cuentas WHERE id = p_id_cuenta;
      -- Admin y médico del paciente tienen acceso
      IF v_tipo IN (1, 2) THEN
        SET v_permitido = 1;
      END IF;
      -- Paciente ve su propio registro
      IF v_tipo = 3 THEN
        SELECT COUNT(*) INTO v_permitido FROM cuentas
         WHERE id = p_id_cuenta AND id_paciente = p_id_paciente;
      END IF;
      -- Familiar vinculado
      IF v_tipo = 4 THEN
        SELECT COUNT(*) INTO v_permitido FROM familiares_paciente
         WHERE id_familiar = p_id_cuenta AND id_paciente = p_id_paciente;
      END IF;
      SELECT v_permitido AS permitido;
    END
  `), 'SP puede_ver_paciente');

  // ── 12. SP: health check (HU-39) ─────────────────────────────────
  await safe(db.query('DROP PROCEDURE IF EXISTS health_check'), 'drop health_check');
  await safe(db.query(`
    CREATE PROCEDURE health_check()
    BEGIN
      SELECT 1 AS db_ok;
    END
  `), 'SP health_check');

  console.log('\n✅ sync_db_v2 completo');
  process.exit(0);
}

async function safe(promise, label) {
  try {
    await promise;
    console.log(`✅ ${label}`);
  } catch (e) {
    console.log(`⚠️  ${label}: ${e.message}`);
  }
}

run().catch(e => { console.error('ERROR FATAL:', e.message); process.exit(1); });
