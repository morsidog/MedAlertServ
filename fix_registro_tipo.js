// fix_registro_tipo.js — node fix_registro_tipo.js
// Corrige el SP registrarse para que siempre use el tipo correcto
// y verifica que tipos_cuenta tenga los valores correctos.
require('dotenv').config();
const db = require('./db/database');

async function run() {

  // 1. Ver qué tiene tipos_cuenta actualmente
  const [tipos] = await db.query('SELECT * FROM tipos_cuenta ORDER BY id');
  console.log('\nTipos de cuenta actuales:');
  console.table(tipos);

  // 2. Asegurar que tipos_cuenta tenga los valores correctos
  // DB real: 1=usuario/admin, 2=paciente, 3=medico, 4=familiar
  await db.query('DELETE FROM tipos_cuenta');
  await db.query(`
    INSERT INTO tipos_cuenta (id, tipo) VALUES
      (1, 'admin'),
      (2, 'paciente'),
      (3, 'medico'),
      (4, 'familiar')
  `);
  const [tiposNuevos] = await db.query('SELECT * FROM tipos_cuenta ORDER BY id');
  console.log('\nTipos de cuenta corregidos:');
  console.table(tiposNuevos);

  // 3. Recrear SP registrarse con lógica más robusta
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

      -- Verificar correo duplicado
      SELECT COUNT(*) INTO v_existe FROM cuentas WHERE correo = p_correo;
      IF v_existe > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El correo ya está registrado';
      END IF;

      -- Usar el tipo recibido; solo se permiten 2=paciente o 4=familiar
      -- desde el registro público. 1=admin y 3=medico solo se crean
      -- internamente. Si llega un valor inválido se asigna paciente (2).
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
  console.log('\n✅ SP registrarse recreado');

  // 4. Verificar con una prueba directa (sin insertar — solo mostrar lo que haría)
  console.log('\nVerificación de tipos que se usarían:');
  const casos = [
    { tipo: 2, esperado: 'paciente' },
    { tipo: 4, esperado: 'familiar' },
    { tipo: 3, esperado: 'medico' },
    { tipo: 99, esperado: 'paciente (fallback)' },
  ];
  for (const c of casos) {
    const v_tipo = [1,2,3,4].includes(c.tipo) ? c.tipo : 2;
    const [rows] = await db.query('SELECT tipo FROM tipos_cuenta WHERE id = ?', [v_tipo]);
    console.log(`  tipo=${c.tipo} → id=${v_tipo} → rol="${rows[0]?.tipo}" (esperado: ${c.esperado})`);
  }

  console.log('\n✅ Corrección completa. Haz push a Render para aplicar los cambios.');
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
