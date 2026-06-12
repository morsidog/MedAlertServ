// sync_db.js — corre con: node sync_db.js
require('dotenv').config();
const db = require('./db/database');

async function run() {

  // ── 1. CORREGIR TABLAS EXISTENTES ────────────────────────────────

  // cuentas — agregar columna id_paciente si no existe
 
  // tipos_cuenta — asegurar datos correctos
  await safe(db.query(`
    INSERT IGNORE INTO tipos_cuenta (id, tipo) VALUES
      (1,'admin'),(2,'medico'),(3,'paciente'),(4,'familiar')
  `), 'tipos_cuenta: datos base');

  // ── 2. CREAR TABLAS FALTANTES ─────────────────────────────────────

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      nombre           VARCHAR(150) NOT NULL,
      fecha_nacimiento DATE NOT NULL,
      diagnostico      TEXT,
      dispositivo_id   VARCHAR(50) NULL,
      id_medico        INT NULL,
      activo           TINYINT(1) NOT NULL DEFAULT 1,
      creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `), 'pacientes');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS familiares_paciente (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      id_paciente  INT NOT NULL,
      id_familiar  INT NOT NULL,
      es_principal TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_familiar_paciente (id_paciente, id_familiar)
    )
  `), 'familiares_paciente');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS dispositivos (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      device_id   VARCHAR(50) UNIQUE NOT NULL,
      id_paciente INT NULL,
      ultimo_ping DATETIME NULL
    )
  `), 'dispositivos');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS medicamentos (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      nombre        VARCHAR(100) NOT NULL,
      dosis_mg      DECIMAL(8,2) NOT NULL,
      instrucciones TEXT,
      color_pastilla VARCHAR(30) NULL,
      creado_por    INT NULL
    )
  `), 'medicamentos');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS horarios (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      id_paciente      INT NOT NULL,
      id_medicamento   INT NOT NULL,
      hora             TIME NOT NULL,
      dias             VARCHAR(20) NOT NULL DEFAULT '',
      compartimento    TINYINT NOT NULL,
      activo           TINYINT(1) NOT NULL DEFAULT 1,
      fecha_especifica DATE NULL DEFAULT NULL,
      una_sola_vez     TINYINT(1) NOT NULL DEFAULT 0,
      creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `), 'horarios');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS tomas (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      id_horario          INT NOT NULL,
      id_paciente         INT NOT NULL,
      fecha_programada    DATETIME NOT NULL,
      fecha_confirmada    DATETIME NULL,
      estado              ENUM('pendiente','tomado','omitido') NOT NULL DEFAULT 'pendiente',
      metodo              ENUM('pir','pin','app') NULL,
      nivel_escalamiento  TINYINT NOT NULL DEFAULT 0
    )
  `), 'tomas');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS alertas (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      id_toma    INT NOT NULL,
      nivel      TINYINT NOT NULL,
      enviada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelada  TINYINT(1) NOT NULL DEFAULT 0
    )
  `), 'alertas');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      id_cuenta  INT NOT NULL,
      token      VARCHAR(255) NOT NULL,
      actualizado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cuenta_token (id_cuenta)
    )
  `), 'fcm_tokens');

  await safe(db.query(`
    CREATE TABLE IF NOT EXISTS comandos_arduino (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(50) NOT NULL,
      id_toma   INT NOT NULL,
      comando   VARCHAR(255) NOT NULL,
      enviado   TINYINT(1) NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `), 'comandos_arduino');

  // ── 3. STORED PROCEDURES ─────────────────────────────────────────

  await safe(db.query('DROP PROCEDURE IF EXISTS registrarse'), 'drop registrarse');
  await safe(db.query(`
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
      SELECT c.id, c.nombre, c.correo, t.tipo AS rol
        FROM cuentas c
        JOIN tipos_cuenta t ON t.id = c.tipo
       WHERE c.id = LAST_INSERT_ID();
    END
  `), 'SP registrarse');

  await safe(db.query('DROP PROCEDURE IF EXISTS iniciar_sesion'), 'drop iniciar_sesion');
  await safe(db.query(`
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
      SELECT c.id, c.nombre, c.correo, t.tipo AS rol
        FROM cuentas c
        JOIN tipos_cuenta t ON t.id = c.tipo
       WHERE c.id = v_id;
    END
  `), 'SP iniciar_sesion');

  await safe(db.query('DROP PROCEDURE IF EXISTS crear_paciente'), 'drop crear_paciente');
  await safe(db.query(`
    CREATE PROCEDURE crear_paciente(
      IN p_nombre      VARCHAR(150),
      IN p_nacimiento  DATE,
      IN p_diagnostico TEXT,
      IN p_device_id   VARCHAR(50),
      IN p_id_medico   INT
    )
    BEGIN
      INSERT INTO pacientes (nombre, fecha_nacimiento, diagnostico, dispositivo_id, id_medico)
        VALUES (p_nombre, p_nacimiento, p_diagnostico, p_device_id, p_id_medico);
      SELECT id, nombre, fecha_nacimiento, diagnostico, dispositivo_id
        FROM pacientes WHERE id = LAST_INSERT_ID();
    END
  `), 'SP crear_paciente');

  await safe(db.query('DROP PROCEDURE IF EXISTS crear_horario'), 'drop crear_horario');
  await safe(db.query(`
    CREATE PROCEDURE crear_horario(
      IN p_id_paciente    INT,
      IN p_id_medicamento INT,
      IN p_hora           TIME,
      IN p_dias           VARCHAR(20),
      IN p_compartimento  TINYINT,
      IN p_fecha_especifica DATE,
      IN p_una_sola_vez   TINYINT(1)
    )
    BEGIN
      INSERT INTO horarios
        (id_paciente, id_medicamento, hora, dias, compartimento, fecha_especifica, una_sola_vez)
      VALUES
        (p_id_paciente, p_id_medicamento, p_hora, COALESCE(p_dias,''),
         p_compartimento, p_fecha_especifica, p_una_sola_vez);
      SELECT h.id, h.hora, h.dias, h.compartimento, h.fecha_especifica, h.una_sola_vez,
             m.nombre AS medicamento, m.dosis_mg, m.instrucciones
        FROM horarios h
        JOIN medicamentos m ON m.id = h.id_medicamento
       WHERE h.id = LAST_INSERT_ID();
    END
  `), 'SP crear_horario');

  await safe(db.query('DROP PROCEDURE IF EXISTS registrar_toma'), 'drop registrar_toma');
  await safe(db.query(`
    CREATE PROCEDURE registrar_toma(
      IN p_id_horario  INT,
      IN p_id_paciente INT,
      IN p_fecha       DATETIME
    )
    BEGIN
      DECLARE v_existe INT DEFAULT 0;
      SELECT COUNT(*) INTO v_existe FROM tomas
       WHERE id_horario = p_id_horario
         AND DATE(fecha_programada) = DATE(p_fecha)
         AND estado IN ('pendiente','tomado');
      IF v_existe = 0 THEN
        INSERT INTO tomas (id_horario, id_paciente, fecha_programada)
          VALUES (p_id_horario, p_id_paciente, p_fecha);
        SELECT LAST_INSERT_ID() AS id_toma;
      ELSE
        SELECT NULL AS id_toma;
      END IF;
    END
  `), 'SP registrar_toma');

  await safe(db.query('DROP PROCEDURE IF EXISTS confirmar_toma'), 'drop confirmar_toma');
  await safe(db.query(`
    CREATE PROCEDURE confirmar_toma(
      IN p_id_toma INT,
      IN p_metodo  VARCHAR(10)
    )
    BEGIN
      UPDATE tomas
         SET estado = 'tomado', metodo = p_metodo, fecha_confirmada = NOW()
       WHERE id = p_id_toma AND estado = 'pendiente';
      UPDATE alertas SET cancelada = 1 WHERE id_toma = p_id_toma AND cancelada = 0;
      UPDATE comandos_arduino SET enviado = 1 WHERE id_toma = p_id_toma;
      SELECT ROW_COUNT() AS afectadas;
    END
  `), 'SP confirmar_toma');

  await safe(db.query('DROP PROCEDURE IF EXISTS obtener_pending_arduino'), 'drop obtener_pending_arduino');
  await safe(db.query(`
    CREATE PROCEDURE obtener_pending_arduino(IN p_device_id VARCHAR(50))
    BEGIN
      SELECT ca.id, ca.id_toma, ca.comando
        FROM comandos_arduino ca
       WHERE ca.device_id = p_device_id AND ca.enviado = 0
       ORDER BY ca.creado_en ASC
       LIMIT 1;
    END
  `), 'SP obtener_pending_arduino');

  await safe(db.query('DROP PROCEDURE IF EXISTS obtener_horarios_activos'), 'drop obtener_horarios_activos');
  await safe(db.query(`
    CREATE PROCEDURE obtener_horarios_activos()
    BEGIN
      SELECT h.id AS id_horario, h.id_paciente, h.hora, h.dias,
             h.fecha_especifica, h.una_sola_vez, h.compartimento,
             m.nombre AS medicamento, m.dosis_mg, m.instrucciones,
             p.dispositivo_id AS device_id
        FROM horarios h
        JOIN medicamentos m ON m.id = h.id_medicamento
        JOIN pacientes   p ON p.id = h.id_paciente
       WHERE h.activo = 1 AND p.activo = 1;
    END
  `), 'SP obtener_horarios_activos');

  await safe(db.query('DROP PROCEDURE IF EXISTS desactivar_si_una_sola_vez'), 'drop desactivar_si_una_sola_vez');
  await safe(db.query(`
    CREATE PROCEDURE desactivar_si_una_sola_vez(IN p_id_horario INT)
    BEGIN
      UPDATE horarios SET activo = 0
       WHERE id = p_id_horario AND una_sola_vez = 1;
    END
  `), 'SP desactivar_si_una_sola_vez');

  await safe(db.query('DROP PROCEDURE IF EXISTS obtener_historial'), 'drop obtener_historial');
  await safe(db.query(`
    CREATE PROCEDURE obtener_historial(
      IN p_id_paciente INT,
      IN p_desde       DATE,
      IN p_hasta       DATE,
      IN p_pagina      INT,
      IN p_por_pagina  INT
    )
    BEGIN
      DECLARE v_offset INT DEFAULT (p_pagina - 1) * p_por_pagina;
      SELECT t.id, t.fecha_programada, t.fecha_confirmada,
             t.estado, t.metodo, t.nivel_escalamiento,
             m.nombre AS medicamento
        FROM tomas t
        JOIN horarios     h ON h.id = t.id_horario
        JOIN medicamentos m ON m.id = h.id_medicamento
       WHERE t.id_paciente = p_id_paciente
         AND DATE(t.fecha_programada) BETWEEN p_desde AND p_hasta
       ORDER BY t.fecha_programada DESC
       LIMIT p_por_pagina OFFSET v_offset;
    END
  `), 'SP obtener_historial');

  await safe(db.query('DROP PROCEDURE IF EXISTS calcular_adherencia'), 'drop calcular_adherencia');
  await safe(db.query(`
    CREATE PROCEDURE calcular_adherencia(IN p_id_paciente INT, IN p_semanas INT)
    BEGIN
      SELECT
        YEARWEEK(fecha_programada, 1)                              AS semana,
        COUNT(*)                                                   AS programadas,
        SUM(estado = 'tomado')                                     AS tomadas,
        ROUND(SUM(estado = 'tomado') * 100.0 / COUNT(*), 1)       AS porcentaje
      FROM tomas
      WHERE id_paciente = p_id_paciente
        AND fecha_programada >= DATE_SUB(NOW(), INTERVAL p_semanas WEEK)
      GROUP BY semana
      ORDER BY semana;
    END
  `), 'SP calcular_adherencia');

  console.log('\n✅ Sincronización completa');
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

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
