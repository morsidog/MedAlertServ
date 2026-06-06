-- =============================================================
-- MedAlert — Schema completo
-- Ejecutar en orden. Usar la misma DB que .env apunta.
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- 1. TIPOS DE CUENTA
-- =============================================================
CREATE TABLE IF NOT EXISTS tipos_cuenta (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL
);

INSERT IGNORE INTO tipos_cuenta (id, tipo) VALUES
  (1, 'admin'),
  (2, 'medico'),
  (3, 'paciente'),
  (4, 'familiar');

-- =============================================================
-- 2. CUENTAS  (corrige bug: agrega id_paciente como columna)
-- =============================================================
CREATE TABLE IF NOT EXISTS cuentas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100)  NOT NULL,
  correo      VARCHAR(100)  UNIQUE NOT NULL,
  contraseña  VARCHAR(255)  NOT NULL,
  id_paciente INT           NULL,        -- FK a pacientes (se agrega abajo)
  tipo        INT           NOT NULL DEFAULT 3,
  activo      TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tipo) REFERENCES tipos_cuenta(id)
);

-- =============================================================
-- 3. PACIENTES
-- =============================================================
CREATE TABLE IF NOT EXISTS pacientes (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(150) NOT NULL,
  fecha_nacimiento DATE         NOT NULL,
  diagnostico      TEXT,
  dispositivo_id   VARCHAR(50)  NULL,      -- ej. "DISP-001"
  id_medico        INT          NULL,      -- cuenta tipo medico
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_medico) REFERENCES cuentas(id) ON DELETE SET NULL
);

-- Ahora sí se puede poner la FK de cuentas → pacientes
ALTER TABLE cuentas
  ADD CONSTRAINT fk_cuentas_paciente
  FOREIGN KEY (id_paciente) REFERENCES pacientes(id) ON DELETE SET NULL;

-- =============================================================
-- 4. FAMILIARES_PACIENTE  (relación many-to-many)
-- =============================================================
CREATE TABLE IF NOT EXISTS familiares_paciente (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente  INT NOT NULL,
  id_familiar  INT NOT NULL,               -- cuenta tipo familiar
  es_principal TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_familiar_paciente (id_paciente, id_familiar),
  FOREIGN KEY (id_paciente) REFERENCES pacientes(id)  ON DELETE CASCADE,
  FOREIGN KEY (id_familiar) REFERENCES cuentas(id)    ON DELETE CASCADE
);

-- =============================================================
-- 5. DISPOSITIVOS
-- =============================================================
CREATE TABLE IF NOT EXISTS dispositivos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  device_id    VARCHAR(50) UNIQUE NOT NULL,   -- "DISP-001"
  id_paciente  INT NULL,
  ultimo_ping  DATETIME NULL,
  FOREIGN KEY (id_paciente) REFERENCES pacientes(id) ON DELETE SET NULL
);

-- =============================================================
-- 6. MEDICAMENTOS
-- =============================================================
CREATE TABLE IF NOT EXISTS medicamentos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  dosis_mg     DECIMAL(8,2) NOT NULL,
  instrucciones TEXT,
  color_pastilla VARCHAR(30) NULL,
  creado_por   INT  NULL,
  FOREIGN KEY (creado_por) REFERENCES cuentas(id) ON DELETE SET NULL
);

-- =============================================================
-- 7. HORARIOS
-- =============================================================
CREATE TABLE IF NOT EXISTS horarios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente     INT  NOT NULL,
  id_medicamento  INT  NOT NULL,
  hora            TIME NOT NULL,          -- "08:00:00"
  dias            VARCHAR(20) NOT NULL,   -- "1,2,3,4,5" (1=lun … 7=dom)
  compartimento   TINYINT NOT NULL CHECK (compartimento BETWEEN 1 AND 4),
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente)    REFERENCES pacientes(id)    ON DELETE CASCADE,
  FOREIGN KEY (id_medicamento) REFERENCES medicamentos(id) ON DELETE CASCADE
);

-- =============================================================
-- 8. TOMAS
-- =============================================================
CREATE TABLE IF NOT EXISTS tomas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_horario      INT         NOT NULL,
  id_paciente     INT         NOT NULL,
  fecha_programada DATETIME   NOT NULL,
  fecha_confirmada DATETIME   NULL,
  estado          ENUM('pendiente','tomado','omitido') NOT NULL DEFAULT 'pendiente',
  metodo          ENUM('pir','pin','app') NULL,
  nivel_escalamiento TINYINT  NOT NULL DEFAULT 0,  -- 0-4
  FOREIGN KEY (id_horario)  REFERENCES horarios(id)  ON DELETE CASCADE,
  FOREIGN KEY (id_paciente) REFERENCES pacientes(id) ON DELETE CASCADE
);

-- =============================================================
-- 9. ALERTAS  (registro de cada nivel de escalamiento enviado)
-- =============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_toma     INT      NOT NULL,
  nivel       TINYINT  NOT NULL,   -- 1, 2, 3
  enviada_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelada   TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (id_toma) REFERENCES tomas(id) ON DELETE CASCADE
);

-- =============================================================
-- 10. FCM_TOKENS
-- =============================================================
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  id_cuenta   INT          NOT NULL,
  token       VARCHAR(255) NOT NULL,
  actualizado DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cuenta_token (id_cuenta),
  FOREIGN KEY (id_cuenta) REFERENCES cuentas(id) ON DELETE CASCADE
);

-- =============================================================
-- 11. COMANDOS_ARDUINO  (cola de comandos pendientes por device)
-- =============================================================
CREATE TABLE IF NOT EXISTS comandos_arduino (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  device_id   VARCHAR(50)  NOT NULL,
  id_toma     INT          NOT NULL,
  comando     VARCHAR(255) NOT NULL,   -- "DISPENSE:1:42:Ibuprofeno:400mg"
  enviado     TINYINT(1)   NOT NULL DEFAULT 0,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_toma) REFERENCES tomas(id) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- STORED PROCEDURES
-- =============================================================

DROP PROCEDURE IF EXISTS registrarse;
DELIMITER $$
CREATE PROCEDURE registrarse(
  IN p_nombre     VARCHAR(100),
  IN p_correo     VARCHAR(100),
  IN p_contrasena VARCHAR(255)
)
BEGIN
  DECLARE v_existe INT DEFAULT 0;
  SELECT COUNT(*) INTO v_existe FROM cuentas WHERE correo = p_correo;
  IF v_existe > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo ya está registrado';
  END IF;
  INSERT INTO cuentas (nombre, correo, contraseña, tipo)
    VALUES (p_nombre, p_correo, p_contrasena, 3);
  SELECT id, nombre, correo, tipo FROM cuentas WHERE id = LAST_INSERT_ID();
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS iniciar_sesion;
DELIMITER $$
CREATE PROCEDURE iniciar_sesion(
  IN p_correo     VARCHAR(100),
  IN p_contrasena VARCHAR(255)
)
BEGIN
  DECLARE v_id INT DEFAULT NULL;
  SELECT id INTO v_id
    FROM cuentas
   WHERE correo = p_correo AND contraseña = p_contrasena AND activo = 1
   LIMIT 1;
  IF v_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Credenciales incorrectas';
  END IF;
  SELECT c.id, c.nombre, c.correo, t.tipo AS rol
    FROM cuentas c
    JOIN tipos_cuenta t ON t.id = c.tipo
   WHERE c.id = v_id;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS crear_paciente;
DELIMITER $$
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
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS crear_horario;
DELIMITER $$
CREATE PROCEDURE crear_horario(
  IN p_id_paciente    INT,
  IN p_id_medicamento INT,
  IN p_hora           TIME,
  IN p_dias           VARCHAR(20),
  IN p_compartimento  TINYINT
)
BEGIN
  INSERT INTO horarios (id_paciente, id_medicamento, hora, dias, compartimento)
    VALUES (p_id_paciente, p_id_medicamento, p_hora, p_dias, p_compartimento);
  SELECT h.id, h.hora, h.dias, h.compartimento,
         m.nombre AS medicamento, m.dosis_mg, m.instrucciones
    FROM horarios h
    JOIN medicamentos m ON m.id = h.id_medicamento
   WHERE h.id = LAST_INSERT_ID();
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS registrar_toma;
DELIMITER $$
CREATE PROCEDURE registrar_toma(
  IN p_id_horario  INT,
  IN p_id_paciente INT,
  IN p_fecha       DATETIME
)
BEGIN
  -- Evitar duplicados para la misma hora del día
  DECLARE v_existe INT DEFAULT 0;
  SELECT COUNT(*) INTO v_existe
    FROM tomas
   WHERE id_horario = p_id_horario
     AND DATE(fecha_programada) = DATE(p_fecha)
     AND estado IN ('pendiente', 'tomado');
  IF v_existe = 0 THEN
    INSERT INTO tomas (id_horario, id_paciente, fecha_programada)
      VALUES (p_id_horario, p_id_paciente, p_fecha);
    SELECT LAST_INSERT_ID() AS id_toma;
  ELSE
    SELECT NULL AS id_toma;
  END IF;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS confirmar_toma;
DELIMITER $$
CREATE PROCEDURE confirmar_toma(
  IN p_id_toma INT,
  IN p_metodo  VARCHAR(10)   -- 'pir', 'pin', 'app'
)
BEGIN
  UPDATE tomas
     SET estado = 'tomado',
         metodo = p_metodo,
         fecha_confirmada = NOW()
   WHERE id = p_id_toma AND estado = 'pendiente';
  -- Cancelar alertas pendientes
  UPDATE alertas SET cancelada = 1 WHERE id_toma = p_id_toma AND cancelada = 0;
  -- Marcar comando como enviado
  UPDATE comandos_arduino SET enviado = 1 WHERE id_toma = p_id_toma;
  SELECT ROW_COUNT() AS afectadas;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS obtener_pending_arduino;
DELIMITER $$
CREATE PROCEDURE obtener_pending_arduino(IN p_device_id VARCHAR(50))
BEGIN
  SELECT ca.id, ca.id_toma, ca.comando
    FROM comandos_arduino ca
   WHERE ca.device_id = p_device_id AND ca.enviado = 0
   ORDER BY ca.creado_en ASC
   LIMIT 1;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS obtener_horarios_activos;
DELIMITER $$
CREATE PROCEDURE obtener_horarios_activos()
BEGIN
  SELECT h.id AS id_horario, h.id_paciente, h.hora, h.dias, h.compartimento,
         m.nombre AS medicamento, m.dosis_mg, m.instrucciones,
         p.dispositivo_id AS device_id
    FROM horarios h
    JOIN medicamentos m ON m.id = h.id_medicamento
    JOIN pacientes   p ON p.id = h.id_paciente
   WHERE h.activo = 1 AND p.activo = 1;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS calcular_adherencia;
DELIMITER $$
CREATE PROCEDURE calcular_adherencia(IN p_id_paciente INT, IN p_semanas INT)
BEGIN
  SELECT
    YEARWEEK(fecha_programada, 1)         AS semana,
    COUNT(*)                              AS programadas,
    SUM(estado = 'tomado')                AS tomadas,
    ROUND(SUM(estado = 'tomado') * 100.0 / COUNT(*), 1) AS porcentaje
  FROM tomas
  WHERE id_paciente = p_id_paciente
    AND fecha_programada >= DATE_SUB(NOW(), INTERVAL p_semanas WEEK)
  GROUP BY semana
  ORDER BY semana;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS obtener_historial;
DELIMITER $$
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
    JOIN horarios    h ON h.id = t.id_horario
    JOIN medicamentos m ON m.id = h.id_medicamento
   WHERE t.id_paciente = p_id_paciente
     AND DATE(t.fecha_programada) BETWEEN p_desde AND p_hasta
   ORDER BY t.fecha_programada DESC
   LIMIT p_por_pagina OFFSET v_offset;
END$$
DELIMITER ;

-- =============================================================
-- DATOS DE PRUEBA
-- =============================================================

-- Cuentas
INSERT IGNORE INTO cuentas (id, nombre, correo, contraseña, tipo) VALUES
  (1, 'Admin MedAlert',  'admin@medalert.mx',   'admin123',     1),
  (2, 'Dr. García',      'medico@medalert.mx',  'medico123',    2),
  (3, 'Juan Pérez',      'paciente@medalert.mx','paciente123',  3),
  (4, 'María Pérez',     'familiar@medalert.mx','familiar123',  4);

-- Paciente de prueba
INSERT IGNORE INTO pacientes (id, nombre, fecha_nacimiento, diagnostico, dispositivo_id, id_medico) VALUES
  (1, 'Juan Pérez', '1955-03-15', 'Hipertensión arterial, Diabetes tipo 2', 'DISP-001', 2);

-- Vincular cuenta de paciente
UPDATE cuentas SET id_paciente = 1 WHERE id = 3;

-- Familiar
INSERT IGNORE INTO familiares_paciente (id_paciente, id_familiar, es_principal) VALUES
  (1, 4, 1);

-- Dispositivo
INSERT IGNORE INTO dispositivos (device_id, id_paciente) VALUES
  ('DISP-001', 1);

-- Medicamentos
INSERT IGNORE INTO medicamentos (id, nombre, dosis_mg, instrucciones, color_pastilla) VALUES
  (1, 'Metformina',   500,  'Tomar con alimentos',         'blanco'),
  (2, 'Losartán',     50,   'Tomar en ayunas',             'amarillo'),
  (3, 'Amlodipino',   5,    'Una vez al día por la mañana','rosado');

-- Horarios
INSERT IGNORE INTO horarios (id, id_paciente, id_medicamento, hora, dias, compartimento) VALUES
  (1, 1, 1, '08:00:00', '1,2,3,4,5,6,7', 1),
  (2, 1, 2, '08:00:00', '1,2,3,4,5,6,7', 2),
  (3, 1, 3, '20:00:00', '1,2,3,4,5,6,7', 3);
